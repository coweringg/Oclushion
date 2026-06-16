import { Queue, Worker, type Job, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";

export type JobType = "agent:execute" | "repo:scan" | "audit:cleanup" | "notification:send";

export type JobPayloads = {
  "agent:execute": { agentId: string; task: string; sessionId: string; orgId: string };
  "repo:scan": { repoPath: string; orgId: string; workspaceId: string; depth?: number };
  "audit:cleanup": { retentionDays: number; orgId?: string };
  "notification:send": { userId: string; title: string; body: string; type: "info" | "warning" | "error" };
};

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 86400 * 7, count: 500 },
};

export class JobQueueService {
  private connection: Redis;
  private queues = new Map<JobType, Queue>();
  private workers: Worker[] = [];

  public constructor(redisUrl?: string) {
    this.connection = new Redis(redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    this.connection.on("error", () => {});
  }

  public getQueue(type: JobType): Queue {
    let queue = this.queues.get(type);
    if (!queue) {
      queue = new Queue(type, { connection: this.connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
      this.queues.set(type, queue);
    }
    return queue;
  }

  public async enqueue<T extends JobType>(type: T, payload: JobPayloads[T], opts?: JobsOptions): Promise<Job<JobPayloads[T]>> {
    const queue = this.getQueue(type);
    return queue.add(type, payload, opts) as Promise<Job<JobPayloads[T]>>;
  }

  public createWorker<T extends JobType>(type: T, handler: (job: Job<JobPayloads[T]>) => Promise<void>, concurrency = 1): Worker {
    const worker = new Worker<JobPayloads[T]>(type, async (job) => handler(job), {
      connection: this.connection,
      concurrency,
      lockDuration: 60_000,
      stalledInterval: 30_000,
    });
    worker.on("error", (err) => console.error(`[Worker:${type}] Error:`, err));
    this.workers.push(worker as unknown as Worker);
    return worker as unknown as Worker;
  }

  public async getJobStatus(jobId: string): Promise<{ status: string; returnvalue?: unknown; data?: unknown; failedReason?: string } | null> {
    for (const queue of this.queues.values()) {
      const job = await queue.getJob(jobId);
      if (!job) continue;
      const state = await job.getState();
      return { status: state, data: job.data, returnvalue: job.returnvalue, failedReason: job.failedReason };
    }
    return null;
  }

  public async getQueueCounts(type: JobType): Promise<{ waiting: number; active: number; completed: number; failed: number; delayed: number }> {
    const queue = this.getQueue(type);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  public async shutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all(Array.from(this.queues.values()).map((q) => q.close()));
    await this.connection.quit();
  }
}
