import type { LLMGenerateResponse } from "../llm/provider";
import type { SafeDiffProposal } from "../safe-diff.service";

export type AgentRole = "architect" | "builder" | "reviewer" | "security" | "qa" | "docs";
export type AgentPermission = "read" | "propose" | "execute";
export type AgentTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type AutonomyLevel = "copilot" | "autopilot" | "agi";

export const AGI_MAX_ITERATIONS = 20;

export type AgentDefinition = {
  id: string;
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  permissions: AgentPermission[];
  allowedPaths: string[];
  forbiddenPaths: string[];
  model: string;
};

export type AgentTask = {
  id: string;
  sessionId: string;
  agentRole: AgentRole;
  title: string;
  input: string;
  context: string;
  targetPaths: string[];
  status: AgentTaskStatus;
  autonomyLevel: AutonomyLevel;
  output?: string;
  response?: LLMGenerateResponse;
  proposals: SafeDiffProposal[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
  elapsedMs?: number;
  creditsUsed: number;
  iterationsUsed?: number;
};

export type OrchestratorPlan = {
  id: string;
  userRequest: string;
  tasks: AgentTask[];
  executionMode: "sequential" | "parallel";
  autonomyLevel: AutonomyLevel;
  createdAt: string;
};

export type OrchestratorSnapshot = {
  activePlan: OrchestratorPlan | null;
  tasks: AgentTask[];
  locks: Array<{ path: string; agentRole: AgentRole; sessionId: string; acquiredAt: string }>;
  totalCreditsUsed: number;
};
