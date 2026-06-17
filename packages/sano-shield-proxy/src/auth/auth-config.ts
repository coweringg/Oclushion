import { z } from "zod";

const authEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_KEY_HASH_PEPPER: z.string().min(1, "API_KEY_HASH_PEPPER is required in production").optional(),
  ENABLE_V1_AUTH: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  V1_AUTH_ROLLOUT_PERCENT: z.coerce.number().min(0).max(100).default(100),
  DISABLE_V1_AUTH: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  AUTH_CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  AUTH_CIRCUIT_BREAKER_WINDOW: z.coerce.number().int().positive().default(100),
});

export type AuthConfig = z.infer<typeof authEnvSchema>;

let cached: AuthConfig | null = null;

export function validateAuthConfig(
  source: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const parsed = authEnvSchema.parse(source);

  if (parsed.NODE_ENV === "production" && !source.API_KEY_HASH_PEPPER) {
    throw new Error(
      "API_KEY_HASH_PEPPER is required in production. " +
      "Set it to a unique, high-entropy secret shared between proxy and control-api. " +
      "Without it, API key hashing uses a hardcoded fallback value.",
    );
  }

  if (parsed.DISABLE_V1_AUTH && parsed.ENABLE_V1_AUTH) {
    parsed.ENABLE_V1_AUTH = false;
  }

  cached = parsed;
  return parsed;
}

export function readAuthConfig(): AuthConfig {
  if (!cached) {
    cached = validateAuthConfig();
  }
  return cached;
}

export function resetAuthConfig(): void {
  cached = null;
}

export function isV1AuthEnabled(): boolean {
  return readAuthConfig().ENABLE_V1_AUTH;
}

export function isV1AuthDisabled(): boolean {
  return readAuthConfig().DISABLE_V1_AUTH;
}

export function getV1RolloutPercent(): number {
  return readAuthConfig().V1_AUTH_ROLLOUT_PERCENT;
}

/**
 * Returns a deterministic fingerprint of the current auth configuration.
 * Every instance with identical env vars produces the same fingerprint.
 *
 * Use in health endpoints + external monitoring (Prometheus) to detect
 * config drift across instances in a rolling deploy or misconfigured pod.
 *
 * Design: simple concatenation hash — no dependencies, pure computation.
 */
export function getConfigFingerprint(): string {
  const cfg = readAuthConfig();
  const raw = [
    `ENABLE_V1_AUTH=${cfg.ENABLE_V1_AUTH}`,
    `DISABLE_V1_AUTH=${cfg.DISABLE_V1_AUTH}`,
    `V1_AUTH_ROLLOUT_PERCENT=${cfg.V1_AUTH_ROLLOUT_PERCENT}`,
    `PEPPER_PRESENT=${Boolean(cfg.API_KEY_HASH_PEPPER)}`,
  ].join("|");
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

export function getCircuitBreakerThreshold(): number {
  return readAuthConfig().AUTH_CIRCUIT_BREAKER_THRESHOLD;
}

export function getCircuitBreakerWindow(): number {
  return readAuthConfig().AUTH_CIRCUIT_BREAKER_WINDOW;
}

export function apiKeyPepper(): string {
  const config = readAuthConfig();
  const pepper = process.env.API_KEY_HASH_PEPPER;
  if (config.NODE_ENV === "production" && !pepper) {
    throw new Error("API_KEY_HASH_PEPPER not set in production");
  }
  return pepper ?? "oclushion-hmac-v1";
}

/**
 * Determines whether a given API key should be authenticated using v1 hashing.
 *
 * ## Distributed Consistency Guarantee
 *
 * This function is **stateless and deterministic**: given the same `apiKeyBody`
 * and the same `V1_AUTH_ROLLOUT_PERCENT` env var, every instance produces the
 * **identical** routing decision.
 *
 * - The djb2 hash is a pure function of `apiKeyBody` — no randomness, no clock,
 *   no shared state.
 * - `V1_AUTH_ROLLOUT_PERCENT` is an env var — operators MUST ensure it is set
 *   to the same value across all instances (config management / k8s ConfigMap /
 *   shared .env).
 * - Result: **same API key → same routing decision on all 1000 instances**.
 *   No instance divergence.
 *
 * ## Why not a shared database column or distributed lock?
 * - A database column would couple auth routing to the control-plane database,
 *   making it unavailable during DB degradation.
 * - A distributed lock adds latency, complexity, and a new failure domain.
 * - A purely computational, env-var-driven approach is the simplest and most
 *   robust: zero coordination, zero state, zero network.
 */
export function shouldUseV1Auth(apiKeyBody: string): boolean {
  if (isV1AuthDisabled()) return false;
  if (!isV1AuthEnabled()) return false;

  const percent = getV1RolloutPercent();
  if (percent >= 100) return true;
  if (percent <= 0) return false;

  let hash = 5381;
  for (let i = 0; i < apiKeyBody.length; i++) {
    hash = ((hash << 5) + hash + apiKeyBody.charCodeAt(i)) | 0;
  }
  const bucket = Math.abs(hash % 100);
  return bucket < percent;
}
