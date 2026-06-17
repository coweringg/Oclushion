import { hostname } from "node:os";

import type { FastifyPluginAsync } from "fastify";

import type { ServiceHealth } from "@oclushion/shared";

import { isV1AuthDisabled, isV1AuthEnabled, getV1RolloutPercent, getConfigFingerprint } from "../auth/auth-config.js";
import { authCircuitBreaker } from "../auth/auth-circuit-breaker.js";
import { authMetrics } from "../auth/auth-metrics.js";
import { runFullSelfCheck, computeConsistencySignals } from "../auth/auth-self-check.js";

const startedAt = Date.now();

/**
 * Instance identifier — unique per process.
 * Stable across health check polls within the same instance lifetime.
 * Enables operators to correlate health state across multiple replicas.
 */
const instanceId = [hostname(), process.pid].join(":");

function buildAuthzStatus(): AuthzHealthResponse {
  const cbTripped = authCircuitBreaker.isTripped();
  const diag = authMetrics.runtimeDiagnostics();
  const consistency = computeConsistencySignals();
  return {
    service: "sano-proxy-authz",
    status: cbTripped ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    instanceId,
    authMode: isV1AuthDisabled() ? "legacy-only" : isV1AuthEnabled() ? "mixed" : "legacy-only",
    v1Enabled: isV1AuthEnabled(),
    v1RolloutPercent: getV1RolloutPercent(),
    v1Disabled: isV1AuthDisabled(),
    pepperConfigured: !!process.env.API_KEY_HASH_PEPPER,
    circuitBreakerTripped: cbTripped,
    circuitBreakerLocal: true,
    anomalyDetectionLocal: true,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    configFingerprint: getConfigFingerprint(),
    runtime: diag,
    consistency,
  };
}

interface AuthzHealthResponse {
  service: string;
  status: string;
  timestamp: string;
  instanceId: string;
  authMode: string;
  v1Enabled: boolean;
  v1RolloutPercent: number;
  v1Disabled: boolean;
  pepperConfigured: boolean;
  circuitBreakerTripped: boolean;
  circuitBreakerLocal: boolean;
  anomalyDetectionLocal: boolean;
  uptimeSeconds: number;
  configFingerprint?: string;
  runtime?: {
    totalAuthAttempts: number;
    totalAuthSuccesses: number;
    successRate: number;
    latencyCount: number;
    v1SuccessRate: number;
    legacySuccessRate: number;
  };
  consistency?: {
    effectiveV1UsageRate: number | null;
    expectedV1UsageRate: number;
    driftDelta: number | null;
    v1AuthSuccesses: number;
    legacyAuthSuccesses: number;
  };
}

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    const response: ServiceHealth & {
      auth?: Record<string, unknown>;
    } = {
      service: "sano-proxy",
      status: "ok",
      version: "1.0.0",
    };

    return response;
  });

  app.get("/authz/health", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async () => {
    return buildAuthzStatus();
  });

  app.get("/authz/metrics", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    return reply
      .header("Content-Type", "text/plain; charset=utf-8; version=0.0.4")
      .send(authMetrics.snapshot());
  });

  app.get("/authz/self-check", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async () => {
    return runFullSelfCheck();
  });
};

export default healthRoutes;
