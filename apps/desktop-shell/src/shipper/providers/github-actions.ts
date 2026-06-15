import { z } from "zod";
import type { DeployConfig, DeployProviderAdapter, DeployState } from "../shipper.types";

const workflowRunsSchema = z.object({
  workflow_runs: z.array(z.object({
    id: z.number(),
    status: z.string(),
    conclusion: z.string().nullable(),
    html_url: z.string().optional(),
    head_sha: z.string().optional(),
  })).optional(),
});

export class GitHubActionsProvider implements DeployProviderAdapter {
  public constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  public async trigger(config: DeployConfig, commitHash: string): Promise<DeployState> {
    if (!config.owner || !config.repo || !config.workflowId) {
      throw new Error("GitHub Actions requires owner, repo and workflowId.");
    }
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflowId}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: config.productionBranch, inputs: { commitHash } }),
      },
    );
    if (!response.ok && response.status !== 204) {
      throw new Error(`GitHub Actions dispatch failed with HTTP ${response.status}`);
    }
    return {
      id: `${config.workflowId}-${commitHash}`,
      provider: "github-actions",
      status: "queued",
      commitHash,
      startedAt: new Date().toISOString(),
      logs: ["GitHub Actions workflow dispatched."],
    };
  }

  public async getStatus(config: DeployConfig, deployId: string): Promise<DeployState> {
    if (!config.owner || !config.repo) {
      throw new Error("GitHub Actions requires owner and repo.");
    }
    const response = await this.fetchImpl(
      `https://api.github.com/repos/${config.owner}/${config.repo}/actions/runs?branch=${config.productionBranch}&per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    if (!response.ok) {
      throw new Error(`GitHub Actions status failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = workflowRunsSchema.parse(raw);
    const run = payload.workflow_runs?.[0];
    return {
      id: run ? String(run.id) : deployId,
      provider: "github-actions",
      status: mapActionsStatus(run?.status, run?.conclusion),
      url: run?.html_url,
      commitHash: run?.head_sha ?? "unknown",
      startedAt: new Date().toISOString(),
      completedAt: run?.conclusion ? new Date().toISOString() : undefined,
      logs: [`GitHub Actions status: ${run?.status ?? "unknown"} ${run?.conclusion ?? ""}`.trim()],
    };
  }
}

function mapActionsStatus(status: string | undefined, conclusion: string | null | undefined): DeployState["status"] {
  if (conclusion === "success") return "success";
  if (conclusion && conclusion !== "success") return "failed";
  if (status === "in_progress") return "building";
  return "queued";
}
