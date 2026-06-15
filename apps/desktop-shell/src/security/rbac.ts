import type { AgentActionType } from "./permission.manager";

export type OrganizationRole = "owner" | "admin" | "security_officer" | "auditor" | "developer" | "viewer";

export type Permission =
  | "org:read"
  | "org:manage"
  | "org:delete"
  | "member:invite"
  | "member:remove"
  | "member:update_role"
  | "billing:read"
  | "billing:manage"
  | "policy:read"
  | "policy:write"
  | "skill:upload"
  | "skill:approve"
  | "agent:configure"
  | "audit:read"
  | "audit:export"
  | "god_mode:enable";

const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  owner: [
    "org:read", "org:manage", "org:delete",
    "member:invite", "member:remove", "member:update_role",
    "billing:read", "billing:manage",
    "policy:read", "policy:write",
    "skill:upload", "skill:approve",
    "agent:configure",
    "audit:read", "audit:export",
    "god_mode:enable",
  ],
  admin: [
    "org:read", "org:manage",
    "member:invite", "member:remove", "member:update_role",
    "billing:read", "billing:manage",
    "policy:read", "policy:write",
    "skill:upload", "skill:approve",
    "agent:configure",
    "audit:read", "audit:export",
  ],
  security_officer: [
    "org:read",
    "policy:read", "policy:write",
    "audit:read",
    "god_mode:enable",
  ],
  auditor: ["org:read", "audit:read", "policy:read"],
  developer: ["org:read", "skill:upload"],
  viewer: ["org:read"],
};

const ROLE_HIERARCHY: Record<OrganizationRole, number> = {
  owner: 5,
  admin: 4,
  security_officer: 3,
  auditor: 2,
  developer: 1,
  viewer: 0,
};

const ROLES: OrganizationRole[] = ["owner", "admin", "security_officer", "auditor", "developer", "viewer"];

export const ALL_ROLES: readonly OrganizationRole[] = ROLES;

export function hasPermission(role: OrganizationRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const allowed = ROLE_PERMISSIONS[role];
  if (!allowed) return false;
  return allowed.includes(permission);
}

export function hasMinimumRole(role: OrganizationRole | null | undefined, minimumRole: OrganizationRole): boolean {
  if (!role) return false;
  const userLevel = ROLE_HIERARCHY[role] ?? -1;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? -1;
  return userLevel >= requiredLevel;
}

const ACTION_REQUIRED_ROLE: Record<AgentActionType, OrganizationRole> = {
  file_write: "developer",
  terminal_command: "developer",
  network_api: "developer",
  deployment: "admin",
};

export function canPerformAction(role: OrganizationRole | null | undefined, actionType: AgentActionType): boolean {
  const required = ACTION_REQUIRED_ROLE[actionType];
  if (!required) return false;
  return hasMinimumRole(role, required);
}

export function canEnableGodMode(role: OrganizationRole | null | undefined): boolean {
  return hasPermission(role, "god_mode:enable");
}
