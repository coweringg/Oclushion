import { timingSafeEqual } from "node:crypto";

import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";

import { KeySet } from "./auth/key-set.js";
import { inc } from "./metrics/metrics.js";
import { rbacPlugin } from "./auth/rbac.middleware.js";
import { startAuditCleanup } from "./jobs/audit-cleanup.js";
import controlRoutes from "./routes/control.js";
import desktopRoutes from "./routes/desktop.js";
import healthRoutes from "./routes/health.js";
import internalRoutes from "./routes/internal.js";
import metricsRoutes from "./routes/metrics.js";
import scimRoutes from "./scim/scim.routes.js";
import { marketplaceRoutes, marketplaceAdminRoutes } from "./routes/marketplace.js";
import { JobQueueService } from "./jobs/queue.service.js";
import jobRoutes from "./routes/jobs.js";
import type { ControlRepository } from "./storage/repository.js";

export type ControlAppOptions = {
  adminToken: string;
  internalToken?: string;
  enableRateLimiting?: boolean;
  rateLimitMax?: number;
  allowedOrigins?: string[];
};

export async function createApp(
  repository: ControlRepository,
  options: ControlAppOptions,
): Promise<FastifyInstance> {
  const allowedOrigins = options.allowedOrigins ?? [
    "http://localhost:1420",
    "http://localhost:3000",
    "https://app.oclushion.com",
    "https://oclushion.com",
  ];

  const app = Fastify({
    logger: {
      redact: {
        paths: ["req.headers.authorization"],
        censor: "[REDACTED]",
      },
    },
    bodyLimit: 1048576,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Oclushion Control API",
        description: "Enterprise API for Oclushion — auth, billing, SSO, audit, policies, marketplace, and connectors",
        version: "1.0.0",
      },
      servers: [{ url: "http://localhost:8082", description: "Development" }],
      tags: [
        { name: "Health", description: "Service health and readiness checks" },
        { name: "Auth", description: "Desktop authentication (register, login, SSO)" },
        { name: "Organizations", description: "Organization CRUD and membership management" },
        { name: "Policies", description: "Security policies and policy versioning" },
        { name: "Billing", description: "Credit purchasing, spend caps, and billing accounts" },
        { name: "Usage", description: "Usage events, credit debits, and balances" },
        { name: "Audit", description: "Audit event logging and export" },
        { name: "SSO", description: "Single sign-on configuration and flows" },
        { name: "SCIM", description: "SCIM token management for identity provisioning" },
        { name: "Marketplace", description: "Skill catalog and content delivery" },
        { name: "Connectors", description: "Third-party connector OAuth flows" },
        { name: "Jobs", description: "Async job queue management (BullMQ)" },
        { name: "Gateway", description: "Gateway API key management" },
        { name: "Internal", description: "Internal service-to-service endpoints" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    
    let corsOrigin: string | undefined;
    if (typeof origin === "string" && allowedOrigins.includes(origin)) {
      corsOrigin = origin;
    }
    
    if (corsOrigin !== undefined) {
      reply.header("Access-Control-Allow-Origin", corsOrigin);
      reply.header("Access-Control-Allow-Credentials", "true");
    }
    
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "authorization,content-type");
    reply.header("Vary", "Origin");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  app.addHook("onRequest", async (request) => {
    inc("oclushion_requests_total", { job: "control-api", method: request.method, path: request.url.split("?")[0] ?? "/" });
  });

  app.register(helmet, { global: true });
  const keySet = options.adminToken.includes(":")
    ? KeySet.fromSerialized(options.adminToken)
    : KeySet.fromSecret(options.adminToken);
  app.register(rbacPlugin, { sessionSecret: options.adminToken, repository, keySet });
  if (options.enableRateLimiting ?? true) {
    app.register(rateLimit, {
      global: true,
      max: options.rateLimitMax ?? 120,
      timeWindow: "1 minute",
    });
  }
  app.register(healthRoutes, { repository });
  app.register(desktopRoutes, { repository, sessionSecret: options.adminToken, keySet });
  app.register(marketplaceRoutes, { prefix: "/v1/marketplace" });
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", async (request, reply) => {
      if (!validBearerToken(request.headers.authorization, options.adminToken)) {
        return reply.code(401).send({ error: "Valid control API administrator token required." });
      }
    });
    protectedApp.register(controlRoutes, { repository });
  });
  app.register(async (internalApp) => {
    internalApp.addHook("preHandler", async (request, reply) => {
      if (!validBearerToken(request.headers.authorization, options.internalToken ?? options.adminToken)) {
        return reply.code(401).send({ error: "Valid internal service token required." });
      }
    });
    internalApp.register(internalRoutes, { repository });
    internalApp.register(scimRoutes, { prefix: "/scim/v2", repository });
  });

  const queue = new JobQueueService();
  app.register(jobRoutes, { queue });
  app.register(metricsRoutes);

  startAuditCleanup(repository);

  return app;
}

function validBearerToken(authorization: string | undefined, expectedToken: string): boolean {
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }
  const suppliedToken = authorization.slice("Bearer ".length);
  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
