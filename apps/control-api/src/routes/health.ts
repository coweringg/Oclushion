import type { FastifyPluginAsync } from "fastify";

import type { ControlRepository } from "../storage/repository.js";
import { s } from "./schema-helpers.js";

const healthRoutes: FastifyPluginAsync<{ repository: ControlRepository }> = async (
  app,
  options,
) => {
  app.get("/health/live", {
    schema: s(["Health"], "Liveness check", "healthLive", {
      response: {
        200: {
          type: "object",
          properties: {
            service: { type: "string" },
            status: { type: "string" },
            version: { type: "string" },
          },
        },
      },
    }),
  }, async () => ({
    service: "oclushion-control-api",
    status: "ok",
    version: "1.0.0",
  }));

  app.get("/health/ready", {
    schema: s(["Health"], "Readiness check including DB", "healthReady"),
  }, async (_request, reply) => {
    try {
      await options.repository.ping();
      return {
        service: "oclushion-control-api",
        status: "ok",
        version: "1.0.0",
        dependencies: { postgres: "ok" },
      };
    } catch {
      return reply.code(503).send({
        service: "oclushion-control-api",
        status: "unavailable",
        dependencies: { postgres: "unavailable" },
      });
    }
  });
};

export default healthRoutes;
