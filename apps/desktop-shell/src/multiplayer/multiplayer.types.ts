import type { AgentRole } from "../agents/types";

export type CollaborationUserRole = "read-only" | "suggest-only" | "full-write";

export type CollaborationUser = {
  id: string;
  name: string;
  avatarUrl?: string;
  color: string;
  type: "human" | "agent";
  role: CollaborationUserRole;
  agentRole?: AgentRole;
  cursorPosition?: {
    lineNumber: number;
    columnNumber: number;
    filePath: string;
  };
};

export type MultiplayerRoom = {
  id: string;
  name: string;
  projectId: string;
  activeUsers: CollaborationUser[];
  activeFilePaths: string[];
  encrypted: boolean;
};

export type OrgRole = "owner" | "admin" | "senior" | "developer" | "viewer";

export type OrgPermissions = {
  canManageUsers: boolean;
  canManageRoles: boolean;
  canCreateRooms: boolean;
  canExecuteTerminal: boolean;
  canLaunchAGI: boolean;
  canApproveReviews: boolean;
};

export type Organization = {
  id: string;
  name: string;
  tier: "free" | "pro" | "enterprise";
  members: Array<{ userId: string; role: OrgRole }>;
  settings: {
    requireInternalReviews: boolean; 
  };
};

export type OrgProject = {
  id: string;
  orgId: string;
  name: string;
  roomIds: string[];
};

export type InviteLink = {
  code: string;
  orgId: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
};

export type InternalReviewRequest = {
  id: string;
  projectId: string;
  authorId: string;
  title: string;
  diff: string;
  status: "pending" | "approved" | "changes_requested";
  createdAt: string;
};

export type ReviewComment = {
  id: string;
  reviewId: string;
  authorId: string;
  filePath: string;
  lineNumber: number;
  content: string;
  resolved: boolean;
  isResolvingWithAI: boolean; 
};

export type TeamSession = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  members: TeamMember[];
  activeConflicts: ConflictAlert[];
  lastStandup?: DailyStandup;
};

export type TeamMember = {
  userId: string;
  userName: string;
  agentId: string;
  agentRole: AgentRole;
  status: "online" | "away" | "offline";
  currentBranch: string;
  currentFile?: string;
  lastActivityAt: string;
};

export type AgentSyncMessage = {
  id: string;
  sessionId: string;
  fromAgentId: string;
  fromUserName: string;
  timestamp: string;
  type: AgentSyncMessageType;
  payload: AgentSyncPayload;
};

export type AgentSyncMessageType =
  | "intent_announce"
  | "intent_complete"
  | "conflict_detected"
  | "conflict_resolved"
  | "knowledge_share"
  | "help_request"
  | "standup_broadcast"
  | "cross_room_awareness";

export type AgentSyncPayload = {
  targetFiles?: string[];
  description: string;
  diff?: string;
  conflictId?: string;
  resolution?: string;
};

export type ConflictAlert = {
  id: string;
  sessionId: string;
  detectedAt: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "auto_resolved" | "manual_resolved" | "dismissed";
  conflictingFiles: string[];
  agents: Array<{
    agentId: string;
    userName: string;
    intendedChange: string;
  }>;
  resolution?: string;
};

export type DailyStandup = {
  id: string;
  sessionId: string;
  generatedAt: string;
  period: { from: string; to: string };
  memberSummaries: StandupMemberSummary[];
  teamHighlights: string[];
  blockers: string[];
};

export type WellbeingStatus = "excellent" | "needs_motivation" | "burnout_risk" | "ai_training_needed";

export type StandupMemberSummary = {
  userId: string;
  userName: string;
  tasksCompleted: string[];
  blockers: string[];
  
  timeStuckOnTaskMinutes: number;
  wellbeingStatus: WellbeingStatus;
  healthScore: number;
  aiCreditsUsed: number;
};
