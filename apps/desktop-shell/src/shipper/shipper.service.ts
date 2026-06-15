import type { SecureExecutor } from "../security/secure-executor";
import { GitHubActionsProvider } from "./providers/github-actions";
import { VercelDeployProvider } from "./providers/vercel.provider";
import type {
  DeployConfig,
  DeployProvider,
  DeployProviderAdapter,
  DeployState,
  ProductionHealthCheck,
} from "./shipper.types";

export type ShipperAuditSink = (event: {
  type: "DEPLOYMENT_STARTED" | "DEPLOYMENT_COMPLETED" | "DEPLOYMENT_ROLLED_BACK";
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
}) => void;

export class ShipperService {
  private readonly providers: Record<DeployProvider, DeployProviderAdapter | null>;

  public constructor(
    private readonly executor: Pick<SecureExecutor, "runCommand">,
    providers: Partial<Record<DeployProvider, DeployProviderAdapter>> = {},
    private readonly auditSink: ShipperAuditSink = () => undefined,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.providers = {
      vercel: providers.vercel ?? new VercelDeployProvider(fetchImpl),
      "github-actions": providers["github-actions"] ?? new GitHubActionsProvider(fetchImpl),
      netlify: providers.netlify ?? null,
      "custom-webhook": providers["custom-webhook"] ?? null,
    };
  }

  public async prepareAndPushGit(input: {
    workspacePath: string;
    branchName: string;
    commitMessage: string;
  }): Promise<string> {
    await this.executor.runCommand({ command: "git", args: ["checkout", "-B", input.branchName], cwd: input.workspacePath, requirePromptOverride: true });
    await this.executor.runCommand({ command: "git", args: ["add", "."], cwd: input.workspacePath, requirePromptOverride: true });
    await this.executor.runCommand({ command: "git", args: ["commit", "-m", input.commitMessage], cwd: input.workspacePath, requirePromptOverride: true });
    const hash = await this.executor.runCommand({ command: "git", args: ["rev-parse", "HEAD"], cwd: input.workspacePath, requirePromptOverride: true });
    await this.executor.runCommand({ command: "git", args: ["push", "origin", input.branchName], cwd: input.workspacePath, requirePromptOverride: true });
    return hash.stdout.trim();
  }

  public async triggerDeployment(config: DeployConfig, commitHash: string): Promise<DeployState> {
    const provider = this.requireProvider(config.provider);
    this.auditSink({
      type: "DEPLOYMENT_STARTED",
      summary: `Deployment started via ${config.provider}`,
      metadata: { provider: config.provider, projectId: config.projectId, commitHash },
    });
    return provider.trigger(config, commitHash);
  }

  public async monitorDeployment(config: DeployConfig, deployId: string, attempts = 30): Promise<DeployState> {
    const provider = this.requireProvider(config.provider);
    let latest: DeployState | null = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      latest = await provider.getStatus(config, deployId);
      if (latest.status === "success" || latest.status === "failed") {
        return latest;
      }
      await wait(1_000);
    }
    return latest ?? {
      id: deployId,
      provider: config.provider,
      status: "failed",
      commitHash: "unknown",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: "Deployment polling timed out.",
      logs: ["Deployment polling timed out."],
    };
  }

  public async runProductionHealthCheck(url: string): Promise<ProductionHealthCheck> {
    const started = performance.now();
    const response = await this.fetchImpl(url, { method: "GET", cache: "no-store" });
    return {
      success: response.ok,
      statusCode: response.status,
      latencyMs: Math.round(performance.now() - started),
    };
  }

  public async rollback(config: DeployConfig, deployId: string): Promise<DeployState> {
    const provider = this.requireProvider(config.provider);
    if (!provider.rollback) {
      throw new Error(`${config.provider} provider does not support rollback.`);
    }
    const result = await provider.rollback(config, deployId);
    this.auditSink({
      type: "DEPLOYMENT_ROLLED_BACK",
      summary: `Deployment rolled back via ${config.provider}`,
      metadata: { provider: config.provider, deployId },
    });
    return result;
  }

  public async ship(input: {
    workspacePath: string;
    branchName: string;
    commitMessage: string;
    config: DeployConfig;
  }): Promise<DeployState> {
    const commitHash = await this.prepareAndPushGit(input);
    const started = await this.triggerDeployment(input.config, commitHash);
    const completed = await this.monitorDeployment(input.config, started.id);
    if (completed.status === "success" && completed.url) {
      const health = await this.runProductionHealthCheck(input.config.healthUrl ?? completed.url);
      if (!health.success) {
        const rollback = await this.rollback(input.config, completed.id);
        return { ...rollback, error: `Canary failed with HTTP ${health.statusCode}` };
      }
    }
    this.auditSink({
      type: "DEPLOYMENT_COMPLETED",
      summary: `Deployment finished with ${completed.status}`,
      metadata: { provider: input.config.provider, deployId: completed.id, url: completed.url ?? null },
    });
    return completed;
  }

  private requireProvider(provider: DeployProvider): DeployProviderAdapter {
    const adapter = this.providers[provider];
    if (!adapter) {
      throw new Error(`Deploy provider not configured: ${provider}`);
    }
    return adapter;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
