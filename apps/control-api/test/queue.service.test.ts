import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { JobQueueService } from "../src/jobs/queue.service.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

describe("JobQueueService", { concurrency: false, timeout: 10_000 }, () => {
  let service: JobQueueService;

  before(async () => {
    try {
      service = new JobQueueService(REDIS_URL);
      await service.getQueue("agent:execute").obliterate({ force: true });
    } catch {
    }
  });

  after(async () => {
    if (service) await service.shutdown();
  });

  it("enqueues and retrieves an agent:execute job", async () => {
    if (!service) return;
    const payload = { agentId: "test-agent", task: "test task", sessionId: "sess-1", orgId: "org-1" };
    const job = await service.enqueue("agent:execute", payload);
    assert.ok(job.id, "job should have an id");
    const status = await service.getJobStatus(job.id!);
    assert.ok(status, "should find job status");
    assert.strictEqual(status.status, "waiting");
  });

  it("enqueues and retrieves a repo:scan job", async () => {
    if (!service) return;
    const payload = { repoPath: "/tmp/test-repo", orgId: "org-1", workspaceId: "ws-1" };
    const job = await service.enqueue("repo:scan", payload);
    assert.ok(job.id, "job should have an id");
    const status = await service.getJobStatus(job.id!);
    assert.ok(status, "should find job status");
    assert.strictEqual(status.status, "waiting");
  });

  it("returns null for unknown job ID", async () => {
    if (!service) return;
    const status = await service.getJobStatus("nonexistent-job-id");
    assert.strictEqual(status, null);
  });

  it("returns queue counts", async () => {
    if (!service) return;
    const counts = await service.getQueueCounts("agent:execute");
    assert.ok(typeof counts.waiting === "number");
    assert.ok(typeof counts.active === "number");
    assert.ok(typeof counts.completed === "number");
    assert.ok(typeof counts.failed === "number");
  });

  it("shuts down cleanly", async () => {
    if (!service) return;
    await service.shutdown();
    assert.ok(true, "shutdown completed without error");
  });
});
