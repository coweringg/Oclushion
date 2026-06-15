import { GodModeStore, type GodModeScope, type GodModeSession } from "./god-mode.store";
import { evaluateAction, ensurePoliciesFetched, getCachedSnapshots } from "../enterprise/policy.service";
import { getOrganization } from "../enterprise/organization.service";
import { getStoredSession } from "../auth.service";
import { canPerformAction, canEnableGodMode, hasMinimumRole, type OrganizationRole } from "./rbac";
import { detectBrowserPii } from "@oclushion/browser-protect";
import type { PolicyEffect } from "@oclushion/shared";
import { z } from "zod";

export type AgentActionType = "file_write" | "terminal_command" | "deployment" | "network_api";

export type PermissionDecision = {
  shouldPrompt: boolean;
  reason: string;
  effect: PolicyEffect;
  godMode: GodModeSession;
};

const DECISIONS_STORAGE_KEY = "ocl_permission_decisions_v1";
const MAX_STORED_DECISIONS = 200;

const destructiveCommandPatterns = [
  /\brm\s+-rf\s+(?:\/|\*|~)/iu,
  /\bRemove-Item\b.+\b-Recurse\b.+\b-Force\b/iu,
  /\bdel\s+\/[fsq]/iu,
  /\bdrop\s+database\b/iu,
  /\bmkfs\b/iu,
  /\bdd\s+if=/iu,
  /\bformat\s+[a-z]:/iu,
  /\bshutdown\b/iu,
];

const blockedNetworkPatterns = [
  /^(?:https?:\/\/)?(?:127\.0\.0\.1|localhost|0\.0\.0\.0)(?::|\/|$)/iu,
  /^(?:https?:\/\/)?10\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::|\/|$)/iu,
  /^(?:https?:\/\/)?172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(?::|\/|$)/iu,
  /^(?:https?:\/\/)?192\.168\.\d{1,3}\.\d{1,3}(?::|\/|$)/iu,
  /[;&|`$]/iu,
];

export type PersistedDecision = {
  actionType: AgentActionType;
  details: string;
  allowed: boolean;
  reason: string;
  effect: PolicyEffect;
  timestamp: string;
};

export class PermissionManager {
  private userRole: OrganizationRole | null = null;

  public constructor(
    private readonly store = new GodModeStore(),
    private readonly decisionStore: PermissionDecisionStore = new LocalStorageDecisionStore(),
  ) {}

  public setUserRole(role: OrganizationRole | null): void {
    this.userRole = role;
  }

  public getUserRole(): OrganizationRole | null {
    return this.userRole;
  }

  public enableGodMode(scope: GodModeScope): GodModeSession {
    if (!canEnableGodMode(this.userRole)) {
      throw new Error("Your role does not have permission to enable God Mode.");
    }
    return this.store.enable(scope);
  }

  public disableGodMode(): GodModeSession {
    return this.store.disable();
  }

  public getGodMode(): GodModeSession {
    return this.store.get();
  }

  public async shouldPromptUser(actionType: AgentActionType, details: string): Promise<PermissionDecision> {
    const godMode = this.store.get();

    if (!canPerformAction(this.userRole, actionType)) {
      const required = actionType === "deployment" ? "admin" : "developer";
      const decision: PermissionDecision = {
        shouldPrompt: true,
        reason: `Your role does not allow this action. Requires at least ${required} role.`,
        effect: "BLOCK",
        godMode,
      };
      this.persistDecision(actionType, details, false, decision.reason, decision.effect);
      return decision;
    }

    if (!godMode.isActive) {
      const decision: PermissionDecision = { shouldPrompt: true, reason: "God Mode is disabled.", effect: "BLOCK", godMode };
      this.persistDecision(actionType, details, false, decision.reason, decision.effect);
      return decision;
    }

    const org = getOrganization();
    if (org) {
      await ensurePoliciesFetched(org.id);
      const session = getStoredSession();
      const detections = detectBrowserPii(details).map((d) => ({
        type: d.type,
        confidence: d.confidence,
      }));

      const policyResult = evaluateAction(actionType, {
        organizationId: org.id,
        actorId: session?.user?.id,
        detections,
        metadata: { role: this.userRole ?? "unknown" },
      });

      if (policyResult.effect === "BLOCK" || policyResult.effect === "REQUIRE_APPROVAL") {
        const decision: PermissionDecision = {
          shouldPrompt: true,
          reason: policyResult.effect === "BLOCK"
            ? `Blocked by policy: ${policyResult.matchedRuleIds.join(", ")}`
            : `Approval required by policy: ${policyResult.matchedRuleIds.join(", ")}`,
          effect: policyResult.effect,
          godMode,
        };
        this.persistDecision(actionType, details, false, decision.reason, decision.effect);
        return decision;
      }
    }

    if (actionType === "terminal_command" && this.isDestructiveCommand(details)) {
      const decision: PermissionDecision = { shouldPrompt: true, reason: "Command matches destructive safety policy.", effect: "BLOCK", godMode };
      this.persistDecision(actionType, details, false, decision.reason, decision.effect);
      return decision;
    }

    if (actionType === "network_api" && this.isBlockedNetworkTarget(details)) {
      const decision: PermissionDecision = { shouldPrompt: true, reason: "Network target is blocked by safety policy.", effect: "BLOCK", godMode };
      this.persistDecision(actionType, details, false, decision.reason, decision.effect);
      return decision;
    }

    if (godMode.scope === "project-only" && actionType === "file_write" && !isProjectRelative(details)) {
      const decision: PermissionDecision = { shouldPrompt: true, reason: "Project-only God Mode cannot write outside the workspace.", effect: "BLOCK", godMode };
      this.persistDecision(actionType, details, false, decision.reason, decision.effect);
      return decision;
    }

    const decision: PermissionDecision = { shouldPrompt: false, reason: "Temporary God Mode authorization is active.", effect: "ALLOW", godMode };
    this.persistDecision(actionType, details, true, decision.reason, decision.effect);
    return decision;
  }

  public isDestructiveCommand(command: string): boolean {
    return destructiveCommandPatterns.some((pattern) => pattern.test(command));
  }

  public isBlockedNetworkTarget(target: string): boolean {
    return blockedNetworkPatterns.some((pattern) => pattern.test(target));
  }

  public getDecisionHistory(): PersistedDecision[] {
    return this.decisionStore.getAll();
  }

  public clearDecisionHistory(): void {
    this.decisionStore.clear();
  }

  private persistDecision(actionType: AgentActionType, details: string, allowed: boolean, reason: string, effect: PolicyEffect): void {
    try {
      this.decisionStore.add({ actionType, details, allowed, reason, effect, timestamp: new Date().toISOString() });
    } catch {
    }
  }
}

function isProjectRelative(filePath: string): boolean {
  if (/\0/.test(filePath)) return false;
  if (/^(?:[a-z]:\\|\/|\\\\)/iu.test(filePath)) return false;
  const decoded = decodeURIComponent(filePath);
  if (/^(?:[a-z]:\\|\/|\\\\)/iu.test(decoded)) return false;
  if (decoded.includes("..") || filePath.includes("..")) return false;
  return true;
}

export interface PermissionDecisionStore {
  add(decision: PersistedDecision): void;
  getAll(): PersistedDecision[];
  clear(): void;
}

export class LocalStorageDecisionStore implements PermissionDecisionStore {
  public add(decision: PersistedDecision): void {
    const decisions = this.getAll();
    decisions.push(decision);
    if (decisions.length > MAX_STORED_DECISIONS) {
      decisions.splice(0, decisions.length - MAX_STORED_DECISIONS);
    }
    localStorage.setItem(DECISIONS_STORAGE_KEY, JSON.stringify(decisions));
  }

  public getAll(): PersistedDecision[] {
    try {
      const stored = localStorage.getItem(DECISIONS_STORAGE_KEY);
      if (!stored) return [];
      const parsed = z.array(z.unknown()).safeParse(JSON.parse(stored));
      if (!parsed.success) return [];
      return parsed.data as PersistedDecision[];
    } catch {
      return [];
    }
  }

  public clear(): void {
    try {
      localStorage.removeItem(DECISIONS_STORAGE_KEY);
    } catch {
    }
  }
}
