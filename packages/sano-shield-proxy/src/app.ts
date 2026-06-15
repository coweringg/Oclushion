import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";

import healthRoutes from "./routes/health.js";
import proxyRoutes, { type ProxyRouteServices } from "./routes/proxy.js";

export type AppSecurityOptions = {
  enableRateLimiting?: boolean;
  rateLimitMax?: number;
  maxBodyBytes?: number;
  ipDenyList?: string[];
};

export function createApp(
  services?: ProxyRouteServices,
  options: AppSecurityOptions = {},
): FastifyInstance {
  const app = Fastify({
    logger: {
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.x-api-key",
          "req.headers.x-oclushion-api-key",
          "req.headers.x-sano-api-key",
        ],
        censor: "[REDACTED]",
      },
    },
    bodyLimit: options.maxBodyBytes ?? 1048576,
  });

  const denyList = new Set((options.ipDenyList ?? []).map((ip) => ip.toLowerCase().trim()));
  if (denyList.size > 0) {
    app.addHook("onRequest", async (request, reply) => {
      const ip = request.ip?.toLowerCase().trim();
      if (ip && denyList.has(ip)) {
        return reply.code(403).send({ error: "Your IP address is not allowed." });
      }
    });
  }

  app.register(helmet, { global: true });
  if (options.enableRateLimiting ?? true) {
    app.register(rateLimit, {
      global: true,
      max: options.rateLimitMax ?? 300,
      timeWindow: "1 minute",
    });
  }
  app.register(healthRoutes);
  if (services) {
    app.register(proxyRoutes, services);
  }

  return app;
}
