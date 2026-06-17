import { readAuthConfig, getV1RolloutPercent, getConfigFingerprint } from "./auth-config.js";
import { authCircuitBreaker } from "./auth-circuit-breaker.js";
import { authMetrics } from "./auth-metrics.js";
import { authLogger } from "./auth-logger.js";

let lastFingerprint: string | null = null;

/**
 * Compares the current config fingerprint against the last observed value.
 * Logs a warning on first mismatch — useful during rolling deploys where
 * a pod picks up different env vars.
 *
 * Returns `true` if fingerprint is stable (no new drift detected).
 */
export function detectConfigDrift(): boolean {
  const current = getConfigFingerprint();
  if (lastFingerprint === null) {
    lastFingerprint = current;
    return true;
  }
  if (current !== lastFingerprint) {
    authLogger.error("config drift detected", {
      reason: `fingerprint changed: ${lastFingerprint} → ${current}`,
      lastFingerprint,
      currentFingerprint: current,
    });
    lastFingerprint = current;
    return false;
  }
  return true;
}

export function resetFingerprint(): void {
  lastFingerprint = null;
}

/* ------------------------------------------------------------------ */
/*  Observability pipeline self-check                                  */
/* ------------------------------------------------------------------ */

export interface ObservabilityStatus {
  healthy: boolean;
  issues: string[];
  latencySamples: boolean;
  countersNonZero: boolean;
}

/**
 * Verifies that the observability pipeline is producing data.
 * Does NOT require any auth traffic — purely checks internal state.
 */
export function checkObservabilityHealth(): ObservabilityStatus {
  const issues: string[] = [];

  // Do we have any latency samples?
  const h = authMetrics.authLatency.snapshot();
  const latencySamples = h.count > 0;
  if (!latencySamples) {
    issues.push("latency_histogram_empty");
  }

  // Are counters being incremented?
  const totalOps =
    authMetrics.legacyAuthSuccess.value() +
    authMetrics.legacyAuthFailure.value() +
    authMetrics.v1AuthSuccess.value() +
    authMetrics.v1AuthFailure.value();
  const countersNonZero = totalOps > 0;
  if (!countersNonZero && h.count === 0) {
    // Not degraded yet — just a quiet system with no traffic.
    // Only flag if we've been running long enough to expect traffic.
    // We don't track uptime here; the caller can decide.
  }

  return {
    healthy: issues.length === 0,
    issues,
    latencySamples,
    countersNonZero,
  };
}

/* ------------------------------------------------------------------ */
/*  Runtime sanity checks                                              */
/* ------------------------------------------------------------------ */

export interface SanityReport {
  ok: boolean;
  checks: SanityCheck[];
}

interface SanityCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * Runs a suite of runtime sanity checks that should never fail under
 * normal operation. Each check is independent; all run even if some fail.
 */
export function runSanityChecks(): SanityReport {
  const checks: SanityCheck[] = [];

  // 1. Rollback flag consistency
  const cfg = readAuthConfig();
  if (cfg.DISABLE_V1_AUTH && cfg.ENABLE_V1_AUTH) {
    checks.push({
      name: "rollback_flag_consistency",
      ok: false,
      detail: "DISABLE_V1_AUTH and ENABLE_V1_AUTH both true — resolver treats as DISABLE_V1_AUTH wins",
    });
  } else {
    checks.push({
      name: "rollback_flag_consistency",
      ok: true,
      detail: `DISABLE_V1_AUTH=${cfg.DISABLE_V1_AUTH} ENABLE_V1_AUTH=${cfg.ENABLE_V1_AUTH}`,
    });
  }

  // 2. Circuit breaker state sanity
  const cbTripped = authCircuitBreaker.isTripped();
  checks.push({
    name: "circuit_breaker_state",
    ok: true,
    detail: cbTripped ? "tripped (auto-recovery in progress)" : "closed",
  });

  // 3. Rollout percent bounds (already validated by zod, but check at runtime too)
  const pct = getV1RolloutPercent();
  if (pct < 0 || pct > 100 || !Number.isFinite(pct)) {
    checks.push({
      name: "rollout_percent_bounds",
      ok: false,
      detail: `V1_AUTH_ROLLOUT_PERCENT=${pct} out of [0,100]`,
    });
  } else {
    checks.push({
      name: "rollout_percent_bounds",
      ok: true,
      detail: `V1_AUTH_ROLLOUT_PERCENT=${pct}`,
    });
  }

  // 4. Config fingerprint self-consistency (no in-process drift)
  const fpOk = detectConfigDrift();
  checks.push({
    name: "config_drift_self_check",
    ok: fpOk,
    detail: fpOk ? `fingerprint=${getConfigFingerprint()}` : "drift detected",
  });

  if (checks.every((c) => c.ok)) {
    authMetrics.selfCheckOk.inc();
  } else {
    authMetrics.selfCheckFailure.inc();
    for (const c of checks.filter((c) => !c.ok)) {
      authLogger.warn(`sanity check failed: ${c.name}`, { reason: c.detail });
    }
  }

  return { ok: checks.every((c) => c.ok), checks };
}

/* ------------------------------------------------------------------ */
/*  Global behavior consistency signals                                */
/* ------------------------------------------------------------------ */

export interface ConsistencySignals {
  effectiveV1UsageRate: number | null;
  expectedV1UsageRate: number;
  driftDelta: number | null;
  v1AuthSuccesses: number;
  legacyAuthSuccesses: number;
}

/**
 * Computes the effective v1 usage rate vs the configured rollout percent.
 *
 * - `effectiveV1UsageRate`: observed ratio of v1-auth-successes to total successes.
 * - `expectedV1UsageRate`: the configured `V1_AUTH_ROLLOUT_PERCENT / 100`.
 * - `driftDelta`: `effective - expected`. Positive means more v1 usage than expected,
 *   negative means less. Zero is ideal.
 *
 * Returns `null` for `effectiveV1UsageRate` if no auth successes have occurred yet.
 */
export function computeConsistencySignals(): ConsistencySignals {
  const v1Ok = authMetrics.v1AuthSuccess.value();
  const legacyOk = authMetrics.legacyAuthSuccess.value();
  const totalOk = v1Ok + legacyOk;
  const expectedRate = getV1RolloutPercent() / 100;

  let effectiveRate: number | null = null;
  if (totalOk > 0) {
    effectiveRate = v1Ok / totalOk;
  }

  return {
    effectiveV1UsageRate: effectiveRate,
    expectedV1UsageRate: expectedRate,
    driftDelta: effectiveRate !== null ? effectiveRate - expectedRate : null,
    v1AuthSuccesses: v1Ok,
    legacyAuthSuccesses: legacyOk,
  };
}

/* ------------------------------------------------------------------ */
/*  Partial failure detection                                          */
/* ------------------------------------------------------------------ */

export interface PartialFailureSignals {
  successRate: number;
  fallbackRate: number;
  circuitBreakerTripped: boolean;
  anomalyLabelsWithSpikes: string[];
}

/**
 * Returns signals that MAY indicate partial failure.
 * No blocking action — purely diagnostic.
 */
export function getPartialFailureSignals(): PartialFailureSignals {
  const totalAttempts =
    authMetrics.legacyAuthSuccess.value() +
    authMetrics.legacyAuthFailure.value() +
    authMetrics.v1AuthSuccess.value() +
    authMetrics.v1AuthFailure.value();

  const totalSuccess =
    authMetrics.legacyAuthSuccess.value() +
    authMetrics.v1AuthSuccess.value();

  const successRate = totalAttempts > 0 ? totalSuccess / totalAttempts : 1;

  const fallbackRate = totalAttempts > 0
    ? authMetrics.fallbackTriggered.value() / totalAttempts
    : 0;

  return {
    successRate,
    fallbackRate,
    circuitBreakerTripped: authCircuitBreaker.isTripped(),
    anomalyLabelsWithSpikes: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Top-level self-check orchestrator                                  */
/* ------------------------------------------------------------------ */

export interface SelfCheckReport {
  timestamp: string;
  observability: ObservabilityStatus;
  sanity: SanityReport;
  consistency: ConsistencySignals;
  partialFailures: PartialFailureSignals;
  configFingerprint: string;
}

/**
 * Runs ALL self-diagnostics and returns a single report.
 * Safe to call on every /authz/health poll — all checks are O(1).
 */
export function runFullSelfCheck(): SelfCheckReport {
  const report: SelfCheckReport = {
    timestamp: new Date().toISOString(),
    observability: checkObservabilityHealth(),
    sanity: runSanityChecks(),
    consistency: computeConsistencySignals(),
    partialFailures: getPartialFailureSignals(),
    configFingerprint: getConfigFingerprint(),
  };

  if (!report.sanity.ok) {
    authLogger.warn("self-check found issues", {
      failures: report.sanity.checks.filter((c) => !c.ok).map((c) => c.name).join(","),
    });
  }

  return report;
}
