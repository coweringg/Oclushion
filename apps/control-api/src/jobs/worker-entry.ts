import { JobQueueService } from "./queue.service.js";
import { handleAgentExecution, handleRepoScan } from "./workers/index.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const service = new JobQueueService(redisUrl);

service.createWorker("agent:execute", async (job) => {
  await handleAgentExecution(job);
}, parseInt(process.env.AGENT_WORKER_CONCURRENCY ?? "2", 10));

service.createWorker("repo:scan", async (job) => {
  await handleRepoScan(job);
}, parseInt(process.env.REPO_WORKER_CONCURRENCY ?? "1", 10));

console.log("[WorkerEntry] Workers started. Waiting for jobs...");
process.on("SIGTERM", async () => { console.log("[WorkerEntry] Shutting down..."); await service.shutdown(); process.exit(0); });
process.on("SIGINT", async () => { console.log("[WorkerEntry] Shutting down..."); await service.shutdown(); process.exit(0); });
