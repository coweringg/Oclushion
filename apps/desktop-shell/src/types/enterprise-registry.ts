import type { SkillCategory } from "../marketplace/marketplace.types";

export type OrgRole = "owner" | "admin" | "security_officer" | "auditor" | "developer" | "viewer";

export type OrgPlan = "team" | "enterprise";

export type OrgSettings = {
  allowMemberUploads: boolean;
  requireAdminApproval: boolean;
  allowedCategories: SkillCategory[];
  maxSkillsPerOrg: number;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  createdAt: string;
  settings: OrgSettings;
};

export type OrgMember = {
  userId: string;
  email: string;
  name: string;
  role: OrgRole;
  joinedAt: string;
};

export type InviteMemberInput = {
  email: string;
  role: OrgRole;
};

export type EnterpriseSkillStatus = "draft" | "pending" | "approved" | "archived";

export type EnterpriseSkillVisibility = "org" | "team";

export type EnterpriseSkill = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  category: SkillCategory;
  version: string;
  content: string;
  sha256: string;
  createdBy: string;
  approvedBy?: string;
  status: EnterpriseSkillStatus;
  visibility: EnterpriseSkillVisibility;
  allowedTeams?: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateEnterpriseSkillInput = {
  name: string;
  description: string;
  category: SkillCategory;
  version: string;
  content: string;
  visibility?: EnterpriseSkillVisibility;
  allowedTeams?: string[];
  tags?: string[];
};

export type UpdateEnterpriseSkillInput = {
  name?: string;
  description?: string;
  category?: SkillCategory;
  version?: string;
  content?: string;
  visibility?: EnterpriseSkillVisibility;
  allowedTeams?: string[];
  tags?: string[];
  status?: EnterpriseSkillStatus;
};

export type EnterpriseAgentStatus = "draft" | "pending" | "approved" | "archived";

export type EnterpriseAgent = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  role: string;
  systemPrompt: string;
  skillIds: string[];
  mcpIds: string[];
  status: EnterpriseAgentStatus;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateEnterpriseAgentInput = {
  name: string;
  description: string;
  role: string;
  systemPrompt: string;
  skillIds?: string[];
  mcpIds?: string[];
};

export type UpdateEnterpriseAgentInput = {
  name?: string;
  description?: string;
  role?: string;
  systemPrompt?: string;
  skillIds?: string[];
  mcpIds?: string[];
  status?: EnterpriseAgentStatus;
};

export type HookEvent =
  | "pre-save"
  | "post-save"
  | "pre-commit"
  | "post-commit"
  | "pre-push"
  | "file-opened"
  | "file-closed"
  | "ai-response-received"
  | "error-occurred";

export type HookAction =
  | { type: "run-command"; command: string; timeout?: number }
  | { type: "run-skill"; skillId: string }
  | { type: "send-webhook"; url: string; method?: "GET" | "POST" }
  | { type: "notify"; message: string; level: "info" | "warning" | "error" };

export type EnterpriseHook = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  event: HookEvent;
  action: HookAction;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateEnterpriseHookInput = {
  name: string;
  description: string;
  event: HookEvent;
  action: HookAction;
  enabled?: boolean;
};

export type UpdateEnterpriseHookInput = {
  name?: string;
  description?: string;
  event?: HookEvent;
  action?: HookAction;
  enabled?: boolean;
};

export type EnterpriseRegistrySnapshot = {
  organization: Organization;
  skills: EnterpriseSkill[];
  agents: EnterpriseAgent[];
  hooks: EnterpriseHook[];
  members: OrgMember[];
  myRole: OrgRole;
};
