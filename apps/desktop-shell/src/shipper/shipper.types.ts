export type DeployProvider = "vercel" | "netlify" | "github-actions" | "custom-webhook";
export type DeployStatus = "queued" | "building" | "success" | "failed" | "rolled-back";

export type DeployConfig = {
  provider: DeployProvider;
  token: string;
  projectId: string;
  productionBranch: string;
  owner?: string;
  repo?: string;
  workflowId?: string;
  healthUrl?: string;
  rollbackDeploymentId?: string;
};

export type DeployState = {
  id: string;
  provider: DeployProvider;
  status: DeployStatus;
  url?: string;
  commitHash: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  logs: string[];
};

export type ProductionHealthCheck = {
  success: boolean;
  statusCode: number;
  latencyMs: number;
};

export interface DeployProviderAdapter {
  trigger(config: DeployConfig, commitHash: string): Promise<DeployState>;
  getStatus(config: DeployConfig, deployId: string): Promise<DeployState>;
  rollback?(config: DeployConfig, deployId: string): Promise<DeployState>;
}
