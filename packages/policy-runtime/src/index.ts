import {
  policyEvaluationContextSchema,
  policySnapshotSchema,
  type PolicyCondition,
  type PolicyDecision,
  type PolicyEvaluationContext,
  type PolicyRule,
  type PolicySnapshot,
} from "@oclushion/shared";

export type CompiledPolicySnapshot = Omit<PolicySnapshot, "rules"> & {
  readonly rules: readonly PolicyRule[];
};

export function compileSnapshot(input: unknown): CompiledPolicySnapshot {
  const snapshot = policySnapshotSchema.parse(input);
  const rules = [...snapshot.rules]
    .filter((rule) => rule.enabled)
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));

  return Object.freeze({
    ...snapshot,
    rules: Object.freeze(rules),
  });
}

export function evaluatePolicy(
  snapshot: CompiledPolicySnapshot,
  input: PolicyEvaluationContext,
): PolicyDecision {
  const context = policyEvaluationContextSchema.parse(input);

  if (
    snapshot.organizationId !== context.organizationId ||
    snapshot.module !== context.module
  ) {
    return decision(snapshot, "BLOCK", [], [], "snapshot_scope_mismatch");
  }

  const matchingRules = snapshot.rules.filter((rule) => matches(rule, context));
  if (matchingRules.length === 0) {
    return decision(snapshot, "ALLOW", [], [], "no_matching_rule");
  }

  const effect = matchingRules.reduce<PolicyDecision["effect"]>(
    (current, rule) =>
      effectWeight(rule.effect) > effectWeight(current) ? rule.effect : current,
    "ALLOW",
  );
  const tokenizeEntityTypes =
    effect === "TOKENIZE"
      ? [...new Set(
          context.detections
            .filter((detection) =>
              matchingRules.some(
                (rule) =>
                  rule.effect === "TOKENIZE" &&
                  (rule.entityTypes.length === 0 || rule.entityTypes.includes(detection.type)),
              ),
            )
            .map((detection) => detection.type),
        )]
      : [];

  return decision(
    snapshot,
    effect,
    matchingRules.map((rule) => rule.id),
    tokenizeEntityTypes,
    "rule_matched",
  );
}

function matches(rule: PolicyRule, context: PolicyEvaluationContext): boolean {
  const actionMatches = rule.actions.length === 0 || rule.actions.includes(context.action);
  if (!actionMatches) return false;

  const entityMatches =
    rule.entityTypes.length === 0 ||
    context.detections.some((detection) => rule.entityTypes.includes(detection.type));
  if (!entityMatches) return false;

  if (rule.conditions.length > 0) {
    return rule.conditions.every((condition) => evaluateCondition(condition, context));
  }

  return true;
}

function evaluateCondition(condition: PolicyCondition, context: PolicyEvaluationContext): boolean {
  switch (condition.type) {
    case "timeRange":
      return evaluateTimeRange(condition);
    case "actorMatch":
      return evaluateActorMatch(condition, context);
    case "metadataMatch":
      return evaluateMetadataMatch(condition, context);
    default:
      return true;
  }
}

function evaluateTimeRange(condition: PolicyCondition): boolean {
  if (!condition.timeRange) return true;

  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (condition.timeRange.daysOfWeek && condition.timeRange.daysOfWeek.length > 0) {
    const currentDay = now.getUTCDay();
    if (!condition.timeRange.daysOfWeek.includes(currentDay)) return false;
  }

  const startParts = condition.timeRange.start.split(":").map(Number);
  const endParts = condition.timeRange.end.split(":").map(Number);
  const startH = startParts[0] ?? 0;
  const startM = startParts[1] ?? 0;
  const endH = endParts[0] ?? 0;
  const endM = endParts[1] ?? 0;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function evaluateActorMatch(condition: PolicyCondition, context: PolicyEvaluationContext): boolean {
  if (!condition.actorIds || condition.actorIds.length === 0) return true;
  if (!context.actorId) return false;
  return condition.actorIds.includes(context.actorId);
}

function evaluateMetadataMatch(condition: PolicyCondition, context: PolicyEvaluationContext): boolean {
  if (!condition.metadata) return true;
  return Object.entries(condition.metadata).every(([key, value]) => {
    const ctxValue = context.metadata[key];
    return ctxValue !== undefined && String(ctxValue) === value;
  });
}

function decision(
  snapshot: CompiledPolicySnapshot,
  effect: PolicyDecision["effect"],
  matchedRuleIds: string[],
  tokenizeEntityTypes: PolicyDecision["tokenizeEntityTypes"],
  reasonCode: string,
): PolicyDecision {
  return {
    effect,
    matchedRuleIds,
    tokenizeEntityTypes,
    policyVersionId: snapshot.policyVersionId,
    reasonCode,
    requiresMapping: effect === "TOKENIZE" && tokenizeEntityTypes.length > 0,
  };
}

function effectWeight(effect: PolicyDecision["effect"]): number {
  return {
    ALLOW: 0,
    TOKENIZE: 1,
    REQUIRE_APPROVAL: 2,
    BLOCK: 3,
  }[effect];
}
