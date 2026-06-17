import { createHash, createHmac, randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { resetAuthConfig, shouldUseV1Auth, validateAuthConfig, getConfigFingerprint } from "../src/auth/auth-config.js";
import { authCircuitBreaker } from "../src/auth/auth-circuit-breaker.js";
import { authMetrics } from "../src/auth/auth-metrics.js";
import { authAnomalyDetector } from "../src/auth/auth-anomaly-detector.js";
import { PostgresClientApiKeyResolver } from "../src/auth/client-api-key-verifier.js";
import { runSanityChecks, computeConsistencySignals, detectConfigDrift, resetFingerprint } from "../src/auth/auth-self-check.js";

const TEST_PEPPER = "oclushion-hmac-v1";
const TEST_KEY_ID = "e74c10c2-3b54-405e-a806-59979d16b526";
const TEST_ORG_ID = "ae22b1a6-e1fd-43f5-a43d-a0a133db41df";

function buildV1StoredHash(apiKey: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + apiKey + TEST_PEPPER).digest("hex");
  return `v1:${salt}:${hash}`;
}

function buildLegacyStoredHash(apiKey: string): string {
  return createHmac("sha256", TEST_PEPPER).update(apiKey).digest("hex");
}

afterEach(() => {
  authCircuitBreaker.reset();
  authAnomalyDetector.reset();
  resetAuthConfig();
});

describe("auth environment validation", () => {
  it("rejects missing API_KEY_HASH_PEPPER in production", () => {
    expect(() =>
      validateAuthConfig({ NODE_ENV: "production" }),
    ).toThrow("API_KEY_HASH_PEPPER is required in production");
  });

  it("accepts missing API_KEY_HASH_PEPPER in development", () => {
    expect(() =>
      validateAuthConfig({ NODE_ENV: "development" }),
    ).not.toThrow();
  });

  it("accepts API_KEY_HASH_PEPPER in production when set", () => {
    expect(() =>
      validateAuthConfig({ NODE_ENV: "production", API_KEY_HASH_PEPPER: "some-secret-pepper" }),
    ).not.toThrow();
  });
});

describe("feature flags", () => {
  it("disables v1 auth when DISABLE_V1_AUTH is set", () => {
    const config = validateAuthConfig({
      NODE_ENV: "development",
      DISABLE_V1_AUTH: "true",
    });
    expect(config.ENABLE_V1_AUTH).toBe(false);
    expect(config.DISABLE_V1_AUTH).toBe(true);
  });

  it("respects V1_AUTH_ROLLOUT_PERCENT=0", () => {
    const config = validateAuthConfig({
      NODE_ENV: "development",
      V1_AUTH_ROLLOUT_PERCENT: "0",
    });
    expect(config.V1_AUTH_ROLLOUT_PERCENT).toBe(0);
  });

  it("respects V1_AUTH_ROLLOUT_PERCENT=100", () => {
    const config = validateAuthConfig({
      NODE_ENV: "development",
      V1_AUTH_ROLLOUT_PERCENT: "100",
    });
    expect(config.V1_AUTH_ROLLOUT_PERCENT).toBe(100);
  });
});

describe("canary rollout 0% — v1 keys skipped", () => {
  it("skips v1 keys when rollout is 0%", async () => {
    resetAuthConfig();
    validateAuthConfig({
      NODE_ENV: "development",
      V1_AUTH_ROLLOUT_PERCENT: "0",
    });

    const apiKey = "oclushion_live_a00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: buildV1StoredHash(apiKey) }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toBeNull();
  });

  it("resolves legacy keys when rollout is 0%", async () => {
    resetAuthConfig();
    validateAuthConfig({
      NODE_ENV: "development",
      V1_AUTH_ROLLOUT_PERCENT: "0",
    });

    const apiKey = "oclushion_live_b00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: buildLegacyStoredHash(apiKey) }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toMatchObject({
      organizationId: TEST_ORG_ID,
    });
  });
});

describe("rollback — DISABLE_V1_AUTH", () => {
  it("skips v1 keys when v1 is disabled", async () => {
    resetAuthConfig();
    validateAuthConfig({
      NODE_ENV: "development",
      DISABLE_V1_AUTH: "true",
    });

    const apiKey = "oclushion_live_c00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: buildV1StoredHash(apiKey) }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toBeNull();
  });

  it("still resolves legacy keys when v1 is disabled", async () => {
    resetAuthConfig();
    validateAuthConfig({
      NODE_ENV: "development",
      DISABLE_V1_AUTH: "true",
    });

    const apiKey = "oclushion_live_d00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: buildLegacyStoredHash(apiKey) }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await expect(resolver.resolve(apiKey, "proxy:invoke")).resolves.toMatchObject({
      organizationId: TEST_ORG_ID,
    });
  });
});

describe("circuit breaker", () => {
  it("is not tripped initially", () => {
    expect(authCircuitBreaker.isTripped()).toBe(false);
  });

  it("trips on high failure rate", () => {
    authCircuitBreaker.reset();
    for (let i = 0; i < 30; i++) {
      authCircuitBreaker.record(false);
    }
    expect(authCircuitBreaker.isTripped()).toBe(true);
  });

  it("does not trip on low failure rate", () => {
    authCircuitBreaker.reset();
    for (let i = 0; i < 30; i++) {
      authCircuitBreaker.record(i % 5 !== 0);
    }
    expect(authCircuitBreaker.isTripped()).toBe(false);
  });

  it("resets after reset()", () => {
    authCircuitBreaker.reset();
    for (let i = 0; i < 30; i++) {
      authCircuitBreaker.record(false);
    }
    expect(authCircuitBreaker.isTripped()).toBe(true);
    authCircuitBreaker.reset();
    expect(authCircuitBreaker.isTripped()).toBe(false);
  });
});

describe("anomaly detection", () => {
  it("detects spikes for a label", () => {
    authAnomalyDetector.reset();
    for (let i = 0; i < 60; i++) {
      authAnomalyDetector.record("legacy_auth_spike");
    }
    expect(authAnomalyDetector.isSpiking("legacy_auth_spike")).toBe(true);
  });

  it("does not flag low volume as spike", () => {
    authAnomalyDetector.reset();
    for (let i = 0; i < 5; i++) {
      authAnomalyDetector.record("low_volume");
    }
    expect(authAnomalyDetector.isSpiking("low_volume")).toBe(false);
  });
});

describe("metrics emission", () => {
  it("counts v1 auth success", async () => {
    const beforeSuccess = authMetrics.v1AuthSuccess.value();

    const apiKey = "oclushion_live_e00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: buildV1StoredHash(apiKey) }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await resolver.resolve(apiKey, "proxy:invoke");
    expect(authMetrics.v1AuthSuccess.value()).toBe(beforeSuccess + 1);
  });

  it("counts legacy auth success", async () => {
    const beforeSuccess = authMetrics.legacyAuthSuccess.value();

    const apiKey = "oclushion_live_f00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: buildLegacyStoredHash(apiKey) }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await resolver.resolve(apiKey, "proxy:invoke");
    expect(authMetrics.legacyAuthSuccess.value()).toBe(beforeSuccess + 1);
  });

  it("counts v1 auth failure on bad hash", async () => {
    const beforeFail = authMetrics.v1AuthFailure.value();

    const apiKey = "oclushion_live_a00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });

    await resolver.resolve(apiKey, "proxy:invoke");
    expect(authMetrics.v1AuthFailure.value()).toBe(beforeFail + 1);
  });

  it("counts malformed keys", async () => {
    const beforeMalformed = authMetrics.malformedKeys.value();

    const resolver = new PostgresClientApiKeyResolver({
      query: async () => ({ rowCount: 0, rows: [] }),
    });

    await resolver.resolve("totally-invalid-key", "proxy:invoke");
    expect(authMetrics.malformedKeys.value()).toBe(beforeMalformed + 1);
  });

  it("generates a metrics snapshot without throwing", () => {
    const snapshot = authMetrics.snapshot();
    expect(snapshot).toContain("legacy_auth_success_total");
    expect(snapshot).toContain("v1_auth_success_total");
    expect(snapshot).toContain("auth_latency_ms_p95");
  });

  it("uses 'counter' type for monotonically increasing metrics", () => {
    const snapshot = authMetrics.snapshot();
    const lines = snapshot.split("\n");
    const typeLines = lines.filter((l) => l.startsWith("# TYPE "));
    const counterMetrics = typeLines.filter((l) => l.endsWith(" counter"));
    const gaugeMetrics = typeLines.filter((l) => l.endsWith(" gauge"));

    expect(counterMetrics.length).toBeGreaterThan(0);
    expect(gaugeMetrics.length).toBeGreaterThan(0);

    expect(snapshot).toContain("# TYPE legacy_auth_success_total counter");
    expect(snapshot).toContain("# TYPE v1_auth_success_total counter");
    expect(snapshot).toContain("# TYPE auth_uptime_seconds gauge");
  });

  it("produces valid Prometheus exposition format", () => {
    const snapshot = authMetrics.snapshot();
    const lines = snapshot.split("\n").filter((l) => l.length > 0 && !l.startsWith("#"));

    for (const line of lines) {
      // Each data line must match: metric_name value
      expect(line).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]* \d+(\.\d+)?$/);
    }
  });
});

describe("distributed routing consistency", () => {
  const keyBodies: string[] = [
    "a00000000000000000000000000000000",
    "b11111111111111111111111111111111",
    "c22222222222222222222222222222222",
    "d33333333333333333333333333333333",
    "e44444444444444444444444444444444",
    "f55555555555555555555555555555555",
    "g66666666666666666666666666666666",
    "h77777777777777777777777777777777",
    "i88888888888888888888888888888888",
    "j99999999999999999999999999999999",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  ];

  it("produces identical rollout decision per key across simulated instances at same percent", () => {
    resetAuthConfig();
    const percents = [0, 25, 50, 75, 100];

    for (const percent of percents) {
      validateAuthConfig({
        NODE_ENV: "development",
        V1_AUTH_ROLLOUT_PERCENT: String(percent),
      });

      // Simulate 10 independent instances: for each key, all instances agree
      for (const body of keyBodies) {
        const first = shouldUseV1Auth(body);
        for (let instance = 1; instance < 10; instance++) {
          expect(shouldUseV1Auth(body)).toBe(first);
        }
      }
    }
  });

  it("is stateless — same key routes identically before and after different keys", () => {
    resetAuthConfig();
    validateAuthConfig({
      NODE_ENV: "development",
      V1_AUTH_ROLLOUT_PERCENT: "50",
    });

    // First pass
    const firstPass = keyBodies.map((body) => shouldUseV1Auth(body));

    // Interleave with other random keys
    for (let i = 0; i < 100; i++) {
      shouldUseV1Auth(`interleaved_key_${i}_${"x".repeat(30)}`);
    }

    // Second pass — must be identical
    const secondPass = keyBodies.map((body) => shouldUseV1Auth(body));
    expect(secondPass).toEqual(firstPass);
  });

  it("routes deterministically — same key always maps to same bucket", () => {
    resetAuthConfig();
    validateAuthConfig({
      NODE_ENV: "development",
      V1_AUTH_ROLLOUT_PERCENT: "100",
    });

    for (let i = 0; i < 100; i++) {
      const result1 = shouldUseV1Auth("test_body_42");
      const result2 = shouldUseV1Auth("test_body_42");
      expect(result1).toBe(result2);
      expect(result1).toBe(true); // 100% means always v1
    }
  });
});

describe("restart safety", () => {
  it("metrics counters reset to zero on new AuthMetrics instance", () => {
    const fresh = new (authMetrics.constructor as new () => typeof authMetrics)();
    expect(fresh.v1AuthSuccess.value()).toBe(0);
    expect(fresh.legacyAuthSuccess.value()).toBe(0);
    expect(fresh.v1AuthFailure.value()).toBe(0);
    expect(fresh.legacyAuthFailure.value()).toBe(0);
    expect(fresh.malformedKeys.value()).toBe(0);
  });

  it("circuit breaker resets on new instance", () => {
    const fresh = new (authCircuitBreaker.constructor as new () => typeof authCircuitBreaker)();
    expect(fresh.isTripped()).toBe(false);
  });

  it("anomaly detector resets on new instance", () => {
    const fresh = new (authAnomalyDetector.constructor as new () => typeof authAnomalyDetector)();
    expect(fresh.isSpiking("any_label")).toBe(false);
    expect(fresh.ratePerMinute("any_label")).toBe(0);
  });
});

describe("structured logging format", () => {
  it("produces valid JSON lines on stderr", async () => {
    const lines: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    const mockWrite = (chunk: string) => { lines.push(chunk); return true; };
    process.stderr.write = mockWrite as typeof process.stderr.write;

    try {
      const { authLogger } = await import("../src/auth/auth-logger.js");
      authLogger.info("test message", { prefix: "test_prefix", correlationId: "test-corr" });

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(parsed.source).toBe("auth");
        expect(parsed.level).toBe("info");
        expect(parsed.msg).toBe("test message");
        expect(parsed.ts).toBeDefined();
        expect(parsed.instanceId).toBeDefined();
        expect(parsed.prefix).toBe("test_prefix");
        expect(parsed.correlationId).toBe("test-corr");
      }
    } finally {
      process.stderr.write = origWrite;
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Error classification — no silent failures                          */
/* ------------------------------------------------------------------ */

describe("error classification — no silent failures", () => {
  afterEach(() => {
    authCircuitBreaker.reset();
    authAnomalyDetector.reset();
    resetAuthConfig();
  });

  it("classifies invalid key format as invalid_key", async () => {
    const before = authMetrics.authErrorsInvalidKey.value();
    const resolver = new PostgresClientApiKeyResolver({
      query: async () => ({ rowCount: 0, rows: [] }),
    });
    await resolver.resolve("bad", "proxy:invoke");
    expect(authMetrics.authErrorsInvalidKey.value()).toBe(before + 1);
  });

  it("classifies v1 crypto mismatch as crypto_mismatch", async () => {
    const before = authMetrics.authErrorsCryptoMismatch.value();
    const apiKey = "oclushion_live_a00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: "v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });
    await resolver.resolve(apiKey, "proxy:invoke");
    expect(authMetrics.authErrorsCryptoMismatch.value()).toBe(before + 1);
  });

  it("classifies legacy crypto mismatch as crypto_mismatch", async () => {
    const before = authMetrics.authErrorsCryptoMismatch.value();
    const apiKey = "oclushion_live_b00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });
    await resolver.resolve(apiKey, "proxy:invoke");
    expect(authMetrics.authErrorsCryptoMismatch.value()).toBe(before + 1);
  });

  it("classifies malformed v1 stored format as bad_format", async () => {
    const before = authMetrics.authErrorsBadFormat.value();
    const apiKey = "oclushion_live_c00000000000000000000000000000000000000000000000000000000000000";
    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: "v1:only_one_part" }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });
    await resolver.resolve(apiKey, "proxy:invoke");
    expect(authMetrics.authErrorsBadFormat.value()).toBe(before + 1);
  });
});

/* ------------------------------------------------------------------ */
/*  Config drift detection                                             */
/* ------------------------------------------------------------------ */

describe("config drift detection", () => {
  afterEach(() => {
    resetAuthConfig();
    resetFingerprint();
  });

  it("returns true on first call (baseline)", () => {
    validateAuthConfig({ NODE_ENV: "development", V1_AUTH_ROLLOUT_PERCENT: "50" });
    resetFingerprint();
    expect(detectConfigDrift()).toBe(true);
  });

  it("returns true when config has not changed", () => {
    validateAuthConfig({ NODE_ENV: "development", V1_AUTH_ROLLOUT_PERCENT: "50" });
    resetFingerprint();
    detectConfigDrift(); // baseline
    expect(detectConfigDrift()).toBe(true);
  });

  it("returns false when fingerprint changes", () => {
    validateAuthConfig({ NODE_ENV: "development", V1_AUTH_ROLLOUT_PERCENT: "50" });
    resetFingerprint();
    detectConfigDrift(); // baseline
    // Re-validate with different config
    validateAuthConfig({ NODE_ENV: "development", V1_AUTH_ROLLOUT_PERCENT: "100" });
    expect(detectConfigDrift()).toBe(false);
  });

  it("produces deterministic fingerprint across simulated instances at same config", () => {
    const fp1 = getConfigFingerprint();
    const fp2 = getConfigFingerprint();
    expect(fp1).toBe(fp2);
  });

  it("produces different fingerprints for different configs", () => {
    const fp1 = getConfigFingerprint();
    validateAuthConfig({ NODE_ENV: "development", V1_AUTH_ROLLOUT_PERCENT: "0" });
    const fp2 = getConfigFingerprint();
    expect(fp1).not.toBe(fp2);
  });
});

/* ------------------------------------------------------------------ */
/*  Runtime sanity checks                                              */
/* ------------------------------------------------------------------ */

describe("runtime sanity checks", () => {
  afterEach(() => {
    resetAuthConfig();
    resetFingerprint();
    authCircuitBreaker.reset();
  });

  it("reports ok when everything is normal", () => {
    validateAuthConfig({ NODE_ENV: "development" });
    resetFingerprint();
    detectConfigDrift(); // baseline
    const report = runSanityChecks();
    expect(report.ok).toBe(true);
  });

  it("reports ok after config validation normalizes rollback flags", () => {
    // validateAuthConfig normalizes DISABLE_V1_AUTH && ENABLE_V1_AUTH → DISABLE_V1_AUTH wins
    validateAuthConfig({ NODE_ENV: "development", DISABLE_V1_AUTH: "true", ENABLE_V1_AUTH: "true" });
    resetFingerprint();
    detectConfigDrift(); // baseline
    const report = runSanityChecks();
    const flagCheck = report.checks.find((c) => c.name === "rollback_flag_consistency");
    // Config validation resolves the conflict, so check should pass
    expect(flagCheck?.ok).toBe(true);
  });

  it("rollout_percent_bounds check passes with valid config", () => {
    validateAuthConfig({ NODE_ENV: "development", V1_AUTH_ROLLOUT_PERCENT: "50" });
    resetFingerprint();
    detectConfigDrift();
    const report = runSanityChecks();
    const pctCheck = report.checks.find((c) => c.name === "rollout_percent_bounds");
    expect(pctCheck?.ok).toBe(true);
    expect(report.ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Global consistency signals                                         */
/* ------------------------------------------------------------------ */

describe("global consistency signals", () => {
  it("expectedV1UsageRate matches rollout percent / 100", () => {
    validateAuthConfig({ NODE_ENV: "development", V1_AUTH_ROLLOUT_PERCENT: "42" });
    const signals = computeConsistencySignals();
    expect(signals.expectedV1UsageRate).toBe(0.42);
  });

  it("invariant: driftDelta = effective - expected when both defined", async () => {
    const apiKey = "oclushion_live_e00000000000000000000000000000000000000000000000000000000000000";
    const beforeV1 = authMetrics.v1AuthSuccess.value();

    const resolver = new PostgresClientApiKeyResolver({
      query: async (_sql, values) => {
        if (values[0] === apiKey.slice(0, 18)) {
          return {
            rowCount: 1,
            rows: [{ id: TEST_KEY_ID, organization_id: TEST_ORG_ID, scopes: ["proxy:invoke"], key_hash: buildV1StoredHash(apiKey) }],
          };
        }
        return { rowCount: 0, rows: [] };
      },
    });
    await resolver.resolve(apiKey, "proxy:invoke");

    const signals = computeConsistencySignals();
    expect(signals.v1AuthSuccesses).toBe(beforeV1 + 1);
    expect(signals.effectiveV1UsageRate).not.toBeNull();
    expect(signals.driftDelta).not.toBeNull();
    expect(signals.driftDelta).toBeCloseTo(signals.effectiveV1UsageRate! - signals.expectedV1UsageRate, 10);
  });
});
