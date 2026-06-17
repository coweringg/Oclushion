import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";

import type { GatewayPrincipal } from "@oclushion/shared";

import { apiKeyPepper, shouldUseV1Auth } from "./auth-config.js";
import { authCircuitBreaker } from "./auth-circuit-breaker.js";
import { authMetrics } from "./auth-metrics.js";
import { authAnomalyDetector } from "./auth-anomaly-detector.js";
import { authLogger, type AuthErrorClass } from "./auth-logger.js";
import { traceAuthSpan } from "./auth-tracer.js";

/**
 * Record a classified auth error. Every auth failure MUST emit:
 *  1. An error-class counter increment
 *  2. A structured log line with the classification
 *  3. An anomaly detection record (for spike detection)
 *
 * This ensures ZERO silent failures — every non-success has a visible signal.
 */
function recordAuthError(
  errorClass: AuthErrorClass,
  detail: string,
  extra?: { prefix?: string; correlationId?: string; orgId?: string },
): void {
  switch (errorClass) {
    case "invalid_key":
      authMetrics.authErrorsInvalidKey.inc();
      break;
    case "bad_format":
      authMetrics.authErrorsBadFormat.inc();
      break;
    case "config_missing":
      authMetrics.authErrorsConfigMissing.inc();
      break;
    case "crypto_mismatch":
      authMetrics.authErrorsCryptoMismatch.inc();
      break;
    case "unexpected":
      authMetrics.authErrorsUnexpected.inc();
      break;
  }
  authAnomalyDetector.record(errorClass);
  authLogger.warn("auth error", { errorClass, reason: detail, ...extra });
}

function hashApiKeyV1(apiKey: string, salt: string, pepper: string): string {
  return pbkdf2Sync(apiKey, salt + pepper, 1, 32, "sha256").toString("hex");
}

function hashApiKeyLegacy(apiKey: string, pepper: string): string {
  return pbkdf2Sync(apiKey, pepper, 1, 32, "sha256").toString("hex");
}

function getKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 18);
}

export interface ClientApiKeyResolver {
  resolve(apiKey: string, requiredScope: string, correlationId?: string): Promise<GatewayPrincipal | null>;
}

export type ApiKeySqlClient = {
  query(
    text: string,
    values: unknown[],
  ): Promise<{
    rowCount: number | null;
    rows: Array<{ id: string; organization_id: string; scopes: string[]; key_hash?: string }>;
  }>;
};

export class PostgresClientApiKeyResolver implements ClientApiKeyResolver {
  public constructor(private readonly client: ApiKeySqlClient) {}

  public async resolve(apiKey: string, requiredScope: string, correlationId?: string): Promise<GatewayPrincipal | null> {
    return traceAuthSpan("auth.resolve", async () => {
      const startedAt = performance.now();
      const prefix = getKeyPrefix(apiKey);

      if (!isSupportedGatewayApiKey(apiKey)) {
        authMetrics.malformedKeys.inc();
        recordAuthError("invalid_key", "api key format not supported", { prefix, correlationId });
        return null;
      }

      const cbTripped = authCircuitBreaker.isTripped();
      if (cbTripped) {
        authLogger.warn("circuit breaker tripped, legacy-only fallback", { prefix, cbTripped, correlationId });
      }

      const apiKeyBody = apiKey.slice(apiKey.indexOf("_live_") + 6);
      const useV1 = shouldUseV1Auth(apiKeyBody);
      let pepper: string;
      try {
        pepper = apiKeyPepper();
      } catch (err) {
        recordAuthError("config_missing", `pepper not available: ${(err as Error).message}`, { prefix, correlationId });
        return null;
      }

      let result: Awaited<ReturnType<ApiKeySqlClient["query"]>>;
      try {
        result = await this.client.query(
          `SELECT id, organization_id, scopes, key_hash
         FROM client_api_keys
         WHERE key_prefix = $1
           AND revoked_at IS NULL
           AND organization_id IS NOT NULL
           AND (expires_at IS NULL OR expires_at > NOW())
           AND $2 = ANY(scopes)
         ORDER BY created_at DESC`,
          [prefix, requiredScope],
        );
      } catch (err) {
        recordAuthError("unexpected", `db query failed: ${(err as Error).message}`, { prefix, correlationId });
        return null;
      }

      if (result.rows.length === 0) {
        authAnomalyDetector.record("no_rows_found");
      }

      for (const row of result.rows) {
        const stored = row.key_hash ?? "";
        const isV1Format = stored.startsWith("v1:");

        if (isV1Format && !useV1) {
          authAnomalyDetector.record("v1_key_skipped");
          continue;
        }

        const rowStartedAt = performance.now();
        let match = false;
        let authVersion: "v1" | "legacy" = "legacy";

        if (isV1Format) {
          authVersion = "v1";
          const parts = stored.split(":");
          if (parts.length !== 3) {
            authMetrics.malformedKeys.inc();
            recordAuthError("bad_format", "v1 stored hash malformed (expected 3 colon-delimited parts)", { prefix, correlationId });
            continue;
          }
          const actual = hashApiKeyV1(apiKey, parts[1]!, pepper);
          const expected = parts[2]!;
          match =
            actual.length === expected.length &&
            timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
        } else {
          const actual = hashApiKeyLegacy(apiKey, pepper);
          match =
            actual.length === stored.length &&
            timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(stored, "hex"));
        }

        const elapsed = performance.now() - rowStartedAt;
        authMetrics.authLatency.observe(elapsed);

        if (match) {
          if (authVersion === "v1") {
            authMetrics.v1AuthSuccess.inc();
          } else {
            authMetrics.legacyAuthSuccess.inc();
          }
          authCircuitBreaker.record(true);

          this.client
            .query(`UPDATE client_api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id])
            .catch((err: Error) => {
              authLogger.error("last_used_at update failed", { id: row.id, err: err.message, correlationId });
            });

          const totalElapsed = performance.now() - startedAt;
          authLogger.info("resolve ok", {
            authVersion,
            latencyMs: Math.round(totalElapsed * 100) / 100,
            orgId: row.organization_id,
            prefix,
            correlationId,
          });

          return {
            apiKeyId: row.id,
            organizationId: row.organization_id,
            scopes: row.scopes,
          };
        }

        if (authVersion === "v1") {
          authMetrics.v1AuthFailure.inc();
          recordAuthError("crypto_mismatch", "v1 hash did not match stored value", { prefix, correlationId, orgId: row.organization_id });
        } else {
          authMetrics.legacyAuthFailure.inc();
          recordAuthError("crypto_mismatch", "legacy hash did not match stored value", { prefix, correlationId, orgId: row.organization_id });
        }
        authCircuitBreaker.record(false);
      }

      const totalElapsed = performance.now() - startedAt;
      authLogger.warn("resolve failed", { latencyMs: Math.round(totalElapsed * 100) / 100, prefix, correlationId });

      return null;
    });
  }
}

function isSupportedGatewayApiKey(apiKey: string): boolean {
  if (apiKey.length < 32 || apiKey.length > 512) {
    return false;
  }
  let body: string;
  if (apiKey.startsWith("oclushion_live_")) {
    body = apiKey.slice("oclushion_live_".length);
  } else if (apiKey.startsWith("sano_live_")) {
    body = apiKey.slice("sano_live_".length);
  } else {
    return false;
  }
  return body.length > 0 && /^[a-f0-9_-]+$/i.test(body);
}
