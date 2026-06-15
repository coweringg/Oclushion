import type { FastifyPluginAsync } from "fastify";
import { render } from "../metrics/metrics.js";

const metricsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", "text/plain; charset=utf-8");
    return render();
  });
};

export default metricsRoutes;
