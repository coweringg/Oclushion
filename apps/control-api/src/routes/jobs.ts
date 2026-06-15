import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { s } from "./schema-helpers.js";
import { requirePermission } from "../auth/rbac.middleware.js";
import type { JobQueueService } from "../jobs/queue.service.js";

const enqueueAgentSchema = z.object({
  agentId: z.string().min(1),
  task: z.string().min(1),
  sessionId: z.string().min(1),
});
const enqueueRepoSchema = z.object({
  repoPath: z.string().min(1),
  workspaceId: z.string().min(1),
});

const jobRoutes: FastifyPluginAsync<{ queue: JobQueueService }> = async (app, options) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(request as unknown as Record<string, unknown>).session) {
      return reply.code(401).send({ error: "Valid Oclushion desktop session required." });
    }
  };

  app.post("/v1/jobs/agent/execute", {
    preHandler: [requireAuth, requirePermission("agent:execute")],
    schema: s(["Jobs"], "Enqueue an agent execution job", "enqueueAgentJob"),
  }, async (request, reply) => {
    const { agentId, task, sessionId } = enqueueAgentSchema.parse(request.body);
    const session = (request as unknown as Record<string, unknown>).session as { organizationId: string };
    const job = await options.queue.enqueue("agent:execute", { agentId, task, sessionId, orgId: session.organizationId });
    return reply.code(202).send({ jobId: job.id, status: "queued" });
  });

  app.get("/v1/jobs/:jobId/status", {
    preHandler: [requireAuth],
    schema: s(["Jobs"], "Get job status by ID", "getJobStatus"),
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const status = await options.queue.getJobStatus(jobId);
    if (!status) return reply.code(404).send({ error: "Job not found" });
    return reply.send(status);
  });

  app.get("/v1/jobs/queues/:queueName/counts", {
    preHandler: [requireAuth, requirePermission("org:manage")],
    schema: s(["Jobs"], "Get queue counts by queue name", "getQueueCounts"),
  }, async (request, reply) => {
    const { queueName } = request.params as { queueName: "agent:execute" | "repo:scan" };
    const counts = await options.queue.getQueueCounts(queueName);
    return reply.send(counts);
  });

  app.post("/v1/jobs/repo/scan", {
    preHandler: [requireAuth, requirePermission("repo:scan")],
    schema: s(["Jobs"], "Enqueue a repo scan job", "enqueueRepoScanJob"),
  }, async (request, reply) => {
    const { repoPath, workspaceId } = enqueueRepoSchema.parse(request.body);
    const session = (request as unknown as Record<string, unknown>).session as { organizationId: string };
    const job = await options.queue.enqueue("repo:scan", { repoPath, orgId: session.organizationId, workspaceId });
    return reply.code(202).send({ jobId: job.id, status: "queued" });
  });
};

export default jobRoutes;
