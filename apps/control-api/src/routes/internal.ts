import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { policyTargetModuleSchema } from "@oclushion/shared";
import { Redis } from "ioredis";

import type { ControlRepository } from "../storage/repository.js";
import { RepositoryNotFoundError } from "../storage/repository.js";
import { s, uuidParam } from "./schema-helpers.js";

const paramsSchema = z.object({
  organizationId: z.uuid(),
  module: policyTargetModuleSchema,
});

const sessionSchema = z.object({
  token: z.string(),
  user: z.record(z.string(), z.unknown()),
  exp: z.number().optional(),
});

function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL ?? process.env.REDIS_SESSION_URL;
  if (!url) return null;
  return new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true, enableOfflineQueue: false });
}

const internalRoutes: FastifyPluginAsync<{ repository: ControlRepository }> = async (
  app,
  options,
) => {
  app.get("/v1/internal/organizations/:organizationId/modules/:module/snapshot", {
    schema: s(["Internal"], "Get bound published policy snapshot for a module", "internalGetSnapshot", {
      params: {
        type: "object",
        required: ["organizationId", "module"],
        properties: {
          organizationId: uuidParam,
          module: { type: "string", description: "Policy target module" },
        },
      },
    }),
  }, async (request) => {
    const params = paramsSchema.parse(request.params);
    return options.repository.getBoundPublishedSnapshot(params);
  });

  app.get("/v1/internal/session", {
    schema: s(["Internal"], "Get session from Redis store", "internalGetSession"),
  }, async (request, reply) => {
    const redis = getRedisClient();
    if (!redis) return reply.code(501).send({ error: "Redis not configured" });
    const sessionId = (request as unknown as Record<string, unknown>).sessionId as string;
    if (!sessionId) return reply.code(401).send({ error: "No session" });
    const data = await redis.get(`session:${sessionId}`).catch(() => null);
    if (!data) return reply.code(404).send({ error: "Session not found" });
    return JSON.parse(data);
  });

  app.post("/v1/internal/session", {
    schema: s(["Internal"], "Set session in Redis store", "internalSetSession"),
  }, async (request, reply) => {
    const redis = getRedisClient();
    if (!redis) return reply.code(501).send({ error: "Redis not configured" });
    const body = sessionSchema.parse(request.body);
    const sessionId = (request as unknown as Record<string, unknown>).sessionId as string;
    if (!sessionId) return reply.code(401).send({ error: "No session" });
    const ttl = body.exp ? Math.max(300, body.exp - Math.floor(Date.now() / 1000)) : 86400;
    await redis.set(`session:${sessionId}`, JSON.stringify(body), "EX", ttl);
    return reply.code(204).send();
  });

  app.delete("/v1/internal/session", {
    schema: s(["Internal"], "Clear session from Redis store", "internalClearSession"),
  }, async (request, reply) => {
    const redis = getRedisClient();
    if (!redis) return reply.code(501).send({ error: "Redis not configured" });
    const sessionId = (request as unknown as Record<string, unknown>).sessionId as string;
    if (!sessionId) return reply.code(204).send();
    await redis.del(`session:${sessionId}`);
    return reply.code(204).send();
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: "Invalid internal API request.", issues: error.issues });
    }
    if (error instanceof RepositoryNotFoundError) {
      return reply.code(404).send({ error: error.message });
    }
    throw error;
  });
};

export default internalRoutes;
