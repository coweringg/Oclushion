export type SecretKind = "api_key" | "access_token" | "private_key" | "database_url" | "password";

export type AgentWorkspacePolicy = {
  maxFileBytes: number;
  blockedFileNames: string[];
  blockedExtensions: string[];
  ignoredDirectories: string[];
  allowedCommands: string[];
  blockedCommands: string[];
  requireApprovalCommands: string[];
  allowedNetworkHosts: string[];
  blockedToolNames: string[];
  requireApprovalToolNames: string[];
};

export type TokenMapping = {
  token: string;
  original: string;
  kind: SecretKind;
  relativePath: string;
};

export type WorkspaceFileRecord = {
  relativePath: string;
  sourcePath: string;
  workspacePath: string;
  status: "copied" | "sanitized" | "blocked";
  contentKind: "text" | "binary" | "blocked";
  bytes: number;
  tokens: string[];
  reason?: string;
};

export type AgentSessionManifest = {
  id: string;
  projectPath: string;
  workspacePath: string;
  createdAt: string;
  policy: AgentWorkspacePolicy;
  files: WorkspaceFileRecord[];
  mappings: TokenMapping[];
};

export type AgentDecisionEffect = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";

export type AgentExecutionDecision = {
  effect: AgentDecisionEffect;
  reasonCode: string;
  matchedRule: string;
};

export type AgentAuditEvent = {
  eventId: string;
  sessionId: string;
  module: "agent-protect";
  action: "command_exec" | "network_access" | "tool_invocation" | "workspace_apply";
  decision: AgentDecisionEffect;
  status: "allowed" | "blocked" | "pending_approval" | "failed";
  commandHash?: string;
  executable?: string;
  toolName?: string;
  targetHost?: string;
  exitCode?: number | null;
  occurredAt: string;
  metadata: Record<string, string | number | boolean>;
};
