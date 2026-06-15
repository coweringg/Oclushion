import { z } from "zod";
import type { DeployConfig, DeployProviderAdapter, DeployState } from "../shipper.types";

const vercelDeploySchema = z.object({
  id: z.string().optional(),
  url: z.string().optional(),
  readyState: z.string().optional(),
});

const vercelStatusSchema = z.object({
  uid: z.string().optional(),
  url: z.string().optional(),
  readyState: z.string().optional(),
  meta: z.object({
    githubCommitSha: z.string().optional(),
  }).optional(),
});

export class VercelDeployProvider implements DeployProviderAdapter {
  public constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  public async trigger(config: DeployConfig, commitHash: string): Promise<DeployState> {
    const response = await this.fetchImpl("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: config.projectId,
        project: config.projectId,
        target: "production",
        gitSource: {
          type: "github",
          ref: config.productionBranch,
          sha: commitHash,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Vercel deployment failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = vercelDeploySchema.parse(raw);
    return {
      id: required(payload.id, "Vercel deployment id missing"),
      provider: "vercel",
      status: mapVercelStatus(payload.readyState),
      url: payload.url ? `https://${payload.url}` : undefined,
      commitHash,
      startedAt: new Date().toISOString(),
      logs: ["Vercel deployment queued."],
    };
  }

  public async getStatus(config: DeployConfig, deployId: string): Promise<DeployState> {
    const response = await this.fetchImpl(`https://api.vercel.com/v13/deployments/${deployId}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!response.ok) {
      throw new Error(`Vercel status failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = vercelStatusSchema.parse(raw);
    return {
      id: payload.uid ?? deployId,
      provider: "vercel",
      status: mapVercelStatus(payload.readyState),
      url: payload.url ? `https://${payload.url}` : undefined,
      commitHash: payload.meta?.githubCommitSha ?? "unknown",
      startedAt: new Date().toISOString(),
      completedAt: mapVercelStatus(payload.readyState) === "success" ? new Date().toISOString() : undefined,
      logs: [`Vercel status: ${payload.readyState ?? "unknown"}`],
    };
  }

  public async rollback(config: DeployConfig, deployId: string): Promise<DeployState> {
    const target = config.rollbackDeploymentId ?? deployId;
    const response = await this.fetchImpl(`https://api.vercel.com/v13/deployments/${target}/rollback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!response.ok) {
      throw new Error(`Vercel rollback failed with HTTP ${response.status}`);
    }
    return {
      id: target,
      provider: "vercel",
      status: "rolled-back",
      commitHash: "rollback",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      logs: ["Vercel rollback requested."],
    };
  }
}

function mapVercelStatus(status: string | undefined): DeployState["status"] {
  if (status === "READY") return "success";
  if (status === "ERROR" || status === "CANCELED") return "failed";
  if (status === "BUILDING") return "building";
  return "queued";
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}
