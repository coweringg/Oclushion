import type { FastifyPluginAsync } from "fastify";

import type { ServiceHealth } from "@oclushion/shared";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    const response: ServiceHealth = {
      service: "sano-proxy",
      status: "ok",
      version: "1.0.0",
    };

    return response;
  });
};

export default healthRoutes;
