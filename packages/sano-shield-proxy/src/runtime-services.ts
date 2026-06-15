import { Redis } from "ioredis";
import { Pool } from "pg";

import { NoopAuditSink, PostgresPlatformAuditSink } from "./audit/audit-sink.js";
import { PostgresClientApiKeyResolver } from "./auth/client-api-key-verifier.js";
import type { ProxyEnvironment } from "./config/environment.js";
import {
  CompositeDetector,
  HttpPiiDetectorClient,
  LocalSecretDetector,
} from "./detectors/pii-client.js";
import { ControlApiPolicySnapshotCache } from "./policy/policy-snapshot-cache.js";
import type { ProxyRouteServices } from "./routes/proxy.js";
import { RedisTokenMappingStore } from "./storage/token-mapping-store.js";
import { UndiciUpstreamClient } from "./upstream/upstream-client.js";

export type RuntimeServices = {
  proxy: ProxyRouteServices;
  close(): Promise<void>;
};

export async function createRuntimeServices(environment: ProxyEnvironment): Promise<RuntimeServices> {
  const providerBaseUrls = {
    openai: environment.OPENAI_UPSTREAM_BASE_URL,
    anthropic: environment.ANTHROPIC_UPSTREAM_BASE_URL,
  };
  validateUpstreams(providerBaseUrls, environment);

  const redis = new Redis(environment.REDIS_URL, {
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
  });
  const encryptionKey = Buffer.from(environment.TOKEN_MAPPING_ENCRYPTION_KEY, "base64");
  const pool = new Pool({ connectionString: environment.DATABASE_URL });
  const policySnapshots = new ControlApiPolicySnapshotCache(
    environment.CONTROL_API_URL,
    environment.CONTROL_API_INTERNAL_TOKEN,
    environment.PROXY_POLICY_ORGANIZATION_IDS.split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
    environment.POLICY_SNAPSHOT_REFRESH_MS,
    environment.POLICY_SNAPSHOT_MAX_AGE_MS,
  );
  await policySnapshots.start();

  return {
    proxy: {
      detector: new CompositeDetector([
        new LocalSecretDetector(),
        new HttpPiiDetectorClient(environment.PII_SERVICE_URL),
      ]),
      tokenStore: new RedisTokenMappingStore(
        redis,
        encryptionKey,
        environment.TOKEN_MAPPING_TTL_SECONDS,
      ),
      upstream: new UndiciUpstreamClient(),
      providerBaseUrls,
      clientApiKeyResolver: new PostgresClientApiKeyResolver(pool),
      policySnapshots,
      audit: environment.ENABLE_AUDIT_LOG ? new PostgresPlatformAuditSink(pool) : new NoopAuditSink(),
    },
    async close() {
      await policySnapshots.close();
      await redis.quit();
      await pool.end();
    },
  };
}

function validateUpstreams(
  providerBaseUrls: Record<"openai" | "anthropic", string>,
  environment: ProxyEnvironment,
): void {
  const allowedHosts = new Set(
    environment.PROXY_ALLOWED_UPSTREAM_HOSTS.split(",").map((host) => host.trim().toLowerCase()),
  );

  for (const baseUrl of Object.values(providerBaseUrls)) {
    const url = new URL(baseUrl);
    if (!allowedHosts.has(url.hostname.toLowerCase())) {
      throw new Error(`Upstream host is not allowlisted: ${url.hostname}`);
    }
    if (environment.NODE_ENV === "production" && url.protocol !== "https:") {
      throw new Error("Production upstream URLs must use HTTPS.");
    }
  }
}
