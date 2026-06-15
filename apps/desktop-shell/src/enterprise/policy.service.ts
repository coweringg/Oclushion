import { compileSnapshot, evaluatePolicy, type CompiledPolicySnapshot } from "@oclushion/policy-runtime";
import type { PolicyDecision, PolicyEvaluationContext, PolicySnapshot } from "@oclushion/shared";
import { enterpriseApi } from "./enterprise-api.service";

let compiledSnapshots = new Map<string, CompiledPolicySnapshot>();
let lastFetchMs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function getCachedSnapshots(): Map<string, CompiledPolicySnapshot> {
  return compiledSnapshots;
}

export async function fetchPolicies(orgId: string): Promise<Map<string, CompiledPolicySnapshot>> {
  const res = await enterpriseApi<{ snapshots: PolicySnapshot[] }>(
    `/v1/desktop/policies/snapshot`,
  );
  if (res.ok && res.data?.snapshots) {
    const map = new Map<string, CompiledPolicySnapshot>();
    for (const raw of res.data.snapshots) {
      const compiled = compileSnapshot(raw);
      map.set(compiled.module, compiled);
    }
    compiledSnapshots = map;
    lastFetchMs = Date.now();
    return compiledSnapshots;
  }
  return compiledSnapshots;
}

export async function ensurePoliciesFetched(orgId: string): Promise<Map<string, CompiledPolicySnapshot>> {
  if (compiledSnapshots.size === 0 || Date.now() - lastFetchMs > CACHE_TTL_MS) {
    return fetchPolicies(orgId);
  }
  return compiledSnapshots;
}

const ACTION_MODULE_MAP: Record<string, "agent-protect" | "data-protect" | "connectors"> = {
  terminal_command: "agent-protect",
  file_write: "data-protect",
  deployment: "connectors",
  network_api: "connectors",
};

export function evaluateAction(
  action: string,
  context: Omit<PolicyEvaluationContext, "action" | "module" | "organizationId"> & { organizationId?: string },
  snapshots?: Map<string, CompiledPolicySnapshot>,
): PolicyDecision {
  const map = snapshots ?? compiledSnapshots;

  if (!context.organizationId) {
    return {
      effect: "ALLOW",
      matchedRuleIds: [],
      tokenizeEntityTypes: [],
      policyVersionId: "",
      reasonCode: "no_organization",
      requiresMapping: false,
    };
  }

  const module = ACTION_MODULE_MAP[action];
  if (!module) {
    return {
      effect: "ALLOW",
      matchedRuleIds: [],
      tokenizeEntityTypes: [],
      policyVersionId: "",
      reasonCode: "unmapped_action",
      requiresMapping: false,
    };
  }

  const snapshot = map.get(module);
  if (!snapshot) {
    return {
      effect: "ALLOW",
      matchedRuleIds: [],
      tokenizeEntityTypes: [],
      policyVersionId: "",
      reasonCode: "no_policy_bound",
      requiresMapping: false,
    };
  }

  return evaluatePolicy(snapshot, { ...context, module, action } as PolicyEvaluationContext);
}
