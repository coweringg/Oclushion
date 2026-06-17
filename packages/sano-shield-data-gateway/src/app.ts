import { randomUUID, timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";

import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import {
  parseDataProtectionPolicy,
  sanitizeRows,
  SqlRejectedError,
  validateSelectSql,
} from "@oclushion/sano-shield-data-protect";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import type { DataGatewayEnvironment } from "./config/environment.js";
import { resolveEncryptionKey } from "./crypto.js";
import { ensureDataOrganization, persistTokenizedCells, recordDataAudit } from "./storage.js";

const querySchema = z.object({
  organizationId: z.uuid(),
  sql: z.string().min(1).max(20_000),
  params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).default([]),
  context: z.record(z.string(), z.string()).default({}),
});

export function createApp(input: {
  environment: Pick<
    DataGatewayEnvironment,
    | "DATA_GATEWAY_TOKEN"
    | "DATA_PROTECT_ENCRYPTION_KEY"
    | "DATA_PROTECT_POLICIES_JSON"
    | "DATA_GATEWAY_ENABLE_RATE_LIMITING"
    | "DATA_GATEWAY_RATE_LIMIT_MAX"
  >;
  sourcePool: Pool;
  controlPool: Pool;
}): FastifyInstance {
  const app = Fastify({
    logger: {
      redact: { paths: ["req.headers.authorization"], censor: "[REDACTED]" },
    },
  });
  const policy = parseDataProtectionPolicy(input.environment.DATA_PROTECT_POLICIES_JSON);
  const encryptionKey = resolveEncryptionKey(input.environment.DATA_PROTECT_ENCRYPTION_KEY);

  app.register(helmet, { global: true });
  const enableRateLimiting = input.environment.DATA_GATEWAY_ENABLE_RATE_LIMITING ?? true;
  if (enableRateLimiting) {
    app.register(rateLimit, {
      global: true,
      max: input.environment.DATA_GATEWAY_RATE_LIMIT_MAX ?? 120,
      timeWindow: "1 minute",
    });
  }

  const healthRateLimitMax = Number(process.env.DATA_GATEWAY_HEALTH_RATE_LIMIT_MAX) || 60;

  app.get("/health/live", {
    config: enableRateLimiting ? { rateLimit: { max: healthRateLimitMax, timeWindow: "1 minute" } } : undefined,
  }, async () => ({ status: "ok", service: "sano-data-gateway" }));
  app.get("/health/ready", {
    config: enableRateLimiting ? { rateLimit: { max: healthRateLimitMax / 2, timeWindow: "1 minute" } } : undefined,
  }, async (_request, reply) => {
    try {
      await Promise.all([input.sourcePool.query("SELECT 1"), input.controlPool.query("SELECT 1")]);
      return { status: "ok", service: "sano-data-gateway" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/health/")) {
      return;
    }
    if (!validBearerToken(request.headers.authorization, input.environment.DATA_GATEWAY_TOKEN)) {
      return reply.code(401).send({ error: "Valid Data Gateway bearer token required." });
    }
  });

  app.post("/v1/query", async (request, reply) => {
    const startedAt = performance.now();
    const queryId = randomUUID();
    let organizationId = "00000000-0000-4000-8000-000000000000";
    try {
      const body = querySchema.parse(request.body);
      organizationId = body.organizationId;
      await ensureDataOrganization({ pool: input.controlPool, organizationId });
      const validation = validateSelectSql(body.sql, policy);
      const result = await input.sourcePool.query<Record<string, unknown>>(
        validation.normalizedSql,
        body.params,
      );
      const columns = result.fields.map((field) => field.name);
      const sanitized = sanitizeRows({
        table: validation.table,
        columns,
        rows: result.rows,
        policy,
      });
      await persistTokenizedCells({
        pool: input.controlPool,
        organizationId,
        queryId,
        cells: sanitized.tokenizedCells,
        key: encryptionKey,
      });
      const latencyMs = performance.now() - startedAt;
      await recordDataAudit({
        pool: input.controlPool,
        organizationId,
        queryId,
        decision: "ALLOW",
        status: "allowed",
        detectionCounts: sanitized.counts,
        latencyMs,
        metadata: {
          table: validation.table,
          requestedColumns: validation.projectedColumns.join(","),
          returnedRows: sanitized.rows.length,
          limit: validation.limit,
        },
      });
      return {
        queryId,
        decision: "ALLOW",
        columns: sanitized.columns,
        rows: sanitized.rows,
        rowCount: sanitized.rows.length,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = performance.now() - startedAt;
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "Invalid query request.", issues: error.issues });
      }
      if (error instanceof SqlRejectedError) {
        await ensureDataOrganization({ pool: input.controlPool, organizationId });
        await recordDataAudit({
          pool: input.controlPool,
          organizationId,
          queryId,
          decision: "BLOCK",
          status: "blocked",
          detectionCounts: {},
          latencyMs,
          metadata: { reason: error.message },
        });
        return reply.code(403).send({ queryId, decision: "BLOCK", error: error.message });
      }
      throw error;
    }
  });

  return app;
}

function validBearerToken(authorization: string | undefined, expectedToken: string): boolean {
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
