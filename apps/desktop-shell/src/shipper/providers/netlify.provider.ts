import { z } from "zod";
import type { DeployConfig, DeployProviderAdapter, DeployState } from "../shipper.types";

const netlifyDeploySchema = z.object({
  id: z.string().optional(),
  url: z.string().optional(),
  state: z.string().optional(),
  ssl_url: z.string().optional(),
  deploy_url: z.string().optional(),
  commit_ref: z.string().optional(),
});

export class NetlifyDeployProvider implements DeployProviderAdapter {
  public constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  public async trigger(config: DeployConfig, commitHash: string): Promise<DeployState> {
    const response = await this.fetchImpl(
      `https://api.netlify.com/api/v1/sites/${config.projectId}/builds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clear_cache: false }),
      },
    );
    if (!response.ok) {
      throw new Error(`Netlify build trigger failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = netlifyDeploySchema.parse(raw);
    return {
      id: payload.id ?? `netlify-${Date.now()}`,
      provider: "netlify",
      status: "queued",
      commitHash,
      startedAt: new Date().toISOString(),
      logs: ["Netlify build triggered."],
    };
  }

  public async getStatus(config: DeployConfig, deployId: string): Promise<DeployState> {
    const response = await this.fetchImpl(
      `https://api.netlify.com/api/v1/deploys/${deployId}`,
      {
        headers: { Authorization: `Bearer ${config.token}` },
      },
    );
    if (!response.ok) {
      throw new Error(`Netlify status check failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = netlifyDeploySchema.parse(raw);
    return {
      id: payload.id ?? deployId,
      provider: "netlify",
      status: mapNetlifyState(payload.state),
      url: payload.ssl_url ?? payload.deploy_url ?? payload.url,
      commitHash: payload.commit_ref ?? "unknown",
      startedAt: new Date().toISOString(),
      completedAt: payload.state === "ready" ? new Date().toISOString() : undefined,
      logs: [`Netlify status: ${payload.state ?? "unknown"}`],
    };
  }

  public async rollback(config: DeployConfig, deployId: string): Promise<DeployState> {
    const response = await this.fetchImpl(
      `https://api.netlify.com/api/v1/sites/${config.projectId}/rollback`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${config.token}` },
      },
    );
    if (!response.ok) {
      throw new Error(`Netlify rollback failed with HTTP ${response.status}`);
    }
    return {
      id: deployId,
      provider: "netlify",
      status: "rolled-back",
      commitHash: "rollback",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      logs: ["Netlify rollback requested."],
    };
  }
}

function mapNetlifyState(state: string | undefined): DeployState["status"] {
  if (state === "ready") return "success";
  if (state === "error") return "failed";
  if (state === "building" || state === "uploading") return "building";
  return "queued";
}
