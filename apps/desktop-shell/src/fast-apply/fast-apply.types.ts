import type { AgentRole } from "../agents/types";

export type FileApplyStatus = "clean" | "pending-review" | "accepted" | "reverted";

export type FastApplySessionStatus = "pending" | "fully-accepted" | "fully-reverted" | "partially-resolved";

export type FileSnapshot = {
  path: string;
  originalContent: string;
  newContent: string;
  taskId: string;
  agentRole: AgentRole;
  appliedAt: string;
  status: FileApplyStatus;
  linesAdded: number;
  linesRemoved: number;
};

export type FastApplySession = {
  id: string;
  taskId: string;
  snapshots: FileSnapshot[];
  status: FastApplySessionStatus;
  createdAt: string;
  resolvedAt?: string;
};

export type FastApplyFileSystem = {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
};

export type FastApplyAuditSink = (event: {
  type: "CODE_ACCEPTED" | "CODE_REVERTED" | "FAST_APPLY_WRITTEN";
  path: string;
  taskId: string;
  agentRole: AgentRole;
  linesAdded?: number;
  linesRemoved?: number;
  restoredFromSnapshot?: boolean;
}) => void;
