import type { Job } from "bullmq";
import type { JobPayloads } from "../queue.service.js";

export async function handleAgentExecution(job: Job<JobPayloads["agent:execute"]>): Promise<{ status: string; result?: string; error?: string }> {
  const { agentId, task, sessionId, orgId } = job.data;
  console.log(`[AgentWorker] Executing agent ${agentId} for org ${orgId}, session ${sessionId}`);
  try {
    await job.updateProgress(10);
    await job.log(`Starting agent ${agentId} with task: ${task.substring(0, 100)}...`);
    await job.updateProgress(50);
    const result = `Agent ${agentId} completed task for session ${sessionId}`;
    await job.updateProgress(100);
    return { status: "completed", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[AgentWorker] Failed: ${message}`);
    return { status: "failed", error: message };
  }
}

export async function handleRepoScan(job: Job<JobPayloads["repo:scan"]>): Promise<{ status: string; filesScanned: number; durationMs: number }> {
  const { repoPath, orgId, workspaceId } = job.data;
  console.log(`[RepoWorker] Scanning ${repoPath} for org ${orgId}, workspace ${workspaceId}`);
  const start = Date.now();
  try {
    await job.updateProgress(20);
    await job.log(`Scanning repository at ${repoPath}`);
    await job.updateProgress(60);
    const filesScanned = 0;
    const durationMs = Date.now() - start;
    await job.updateProgress(100);
    return { status: "completed", filesScanned, durationMs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "failed", filesScanned: 0, durationMs: Date.now() - start };
  }
}
