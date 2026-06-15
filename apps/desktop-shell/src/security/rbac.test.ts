import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasMinimumRole,
  canPerformAction,
  canEnableGodMode,
} from "./rbac";
import type { OrganizationRole } from "./rbac";

describe("hasPermission", () => {
  it.each([
    ["owner", "org:read", true],
    ["owner", "org:manage", true],
    ["owner", "org:delete", true],
    ["owner", "member:invite", true],
    ["owner", "member:remove", true],
    ["owner", "member:update_role", true],
    ["owner", "billing:read", true],
    ["owner", "billing:manage", true],
    ["owner", "policy:read", true],
    ["owner", "policy:write", true],
    ["owner", "skill:upload", true],
    ["owner", "skill:approve", true],
    ["owner", "agent:configure", true],
    ["owner", "audit:read", true],
    ["owner", "audit:export", true],
    ["owner", "god_mode:enable", true],
    ["admin", "org:read", true],
    ["admin", "org:manage", true],
    ["admin", "org:delete", false],
    ["admin", "god_mode:enable", false],
    ["security_officer", "god_mode:enable", true],
    ["security_officer", "org:manage", false],
    ["security_officer", "member:invite", false],
    ["auditor", "org:read", true],
    ["auditor", "audit:read", true],
    ["auditor", "policy:read", true],
    ["auditor", "org:manage", false],
    ["developer", "org:read", true],
    ["developer", "skill:upload", true],
    ["developer", "member:invite", false],
    ["viewer", "org:read", true],
    ["viewer", "skill:upload", false],
    ["viewer", "org:manage", false],
  ] as const)("role '%s' hasPermission '%s' returns %s", (role, permission, expected) => {
    expect(hasPermission(role, permission)).toBe(expected);
  });

  it("returns false for null role", () => {
    expect(hasPermission(null, "org:read")).toBe(false);
  });

  it("returns false for undefined role", () => {
    expect(hasPermission(undefined, "org:read")).toBe(false);
  });

  it("returns false for unknown role string", () => {
    expect(hasPermission("superadmin" as OrganizationRole, "org:read")).toBe(false);
  });

  it("returns false for unknown permission", () => {
    expect(hasPermission("owner", "unknown:perm" as never)).toBe(false);
  });
});

describe("hasMinimumRole", () => {
  it.each([
    ["owner", "viewer", true],
    ["owner", "owner", true],
    ["admin", "owner", false],
    ["admin", "viewer", true],
    ["admin", "admin", true],
    ["developer", "viewer", true],
    ["developer", "developer", true],
    ["developer", "admin", false],
    ["viewer", "viewer", true],
    ["viewer", "developer", false],
    ["viewer", "owner", false],
    ["security_officer", "auditor", true],
    ["security_officer", "admin", false],
    ["auditor", "security_officer", false],
  ] as const)("role '%s' hasMinimumRole '%s' returns %s", (role, minimumRole, expected) => {
    expect(hasMinimumRole(role, minimumRole)).toBe(expected);
  });

  it("returns false for null role", () => {
    expect(hasMinimumRole(null, "viewer")).toBe(false);
  });

  it("returns false for undefined role", () => {
    expect(hasMinimumRole(undefined, "viewer")).toBe(false);
  });

  it("returns false for unknown role", () => {
    expect(hasMinimumRole("superadmin" as OrganizationRole, "viewer")).toBe(false);
  });
});

describe("canPerformAction", () => {
  it.each([
    ["developer", "file_write", true],
    ["developer", "terminal_command", true],
    ["developer", "network_api", true],
    ["developer", "deployment", false],
    ["admin", "deployment", true],
    ["viewer", "file_write", false],
    ["viewer", "deployment", false],
    ["auditor", "deployment", false],
    ["security_officer", "deployment", false],
    ["owner", "deployment", true],
    ["owner", "file_write", true],
  ] as const)("role '%s' canPerformAction '%s' returns %s", (role, action, expected) => {
    expect(canPerformAction(role, action)).toBe(expected);
  });

  it("returns false for null role", () => {
    expect(canPerformAction(null, "file_write")).toBe(false);
  });

  it("returns false for undefined role", () => {
    expect(canPerformAction(undefined, "file_write")).toBe(false);
  });

  it("returns false for unknown action type", () => {
    expect(canPerformAction("admin", "unknown_action" as never)).toBe(false);
  });
});

describe("canEnableGodMode", () => {
  it.each([
    ["owner", true],
    ["security_officer", true],
    ["admin", false],
    ["auditor", false],
    ["developer", false],
    ["viewer", false],
  ] as const)("role '%s' canEnableGodMode returns %s", (role, expected) => {
    expect(canEnableGodMode(role)).toBe(expected);
  });

  it("returns false for null role", () => {
    expect(canEnableGodMode(null)).toBe(false);
  });

  it("returns false for undefined role", () => {
    expect(canEnableGodMode(undefined)).toBe(false);
  });
});
