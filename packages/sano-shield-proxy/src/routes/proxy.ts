import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { type FastifyPluginAsync } from "fastify";

import { evaluatePolicy } from "@oclushion/policy-runtime";
import { proxyProviderSchema, type ProxyProvider, type SensitiveEntityType } from "@oclushion/shared";

import type { AuditEvent, AuditSink } from "../audit/audit-sink.js";
import type { ClientApiKeyResolver } from "../auth/client-api-key-verifier.js";
import type { TextDetector } from "../detectors/pii-client.js";
import type { PolicySnapshotProvider } from "../policy/policy-snapshot-cache.js";
import {
  inspectPayload,
  reversePayload,
  tokenizePayload,
} from "../sanitizers/payload-sanitizer.js";
import type { TokenMappingStore } from "../storage/token-mapping-store.js";
import type { UpstreamClient } from "../upstream/upstream-client.js";

export type ProxyRouteServices = {
  detector: TextDetector;
  tokenStore: TokenMappingStore;
  upstream: UpstreamClient;
  providerBaseUrls: Record<ProxyProvider, string>;
  clientApiKeyResolver: ClientApiKeyResolver;
  policySnapshots: PolicySnapshotProvider;
  audit?: AuditSink;
};

export function upstreamUrl(base: string, path: string): URL {
  return new URL(path, base.replace(/\/+$/, "") + "/");
}

const proxyRoutes: FastifyPluginAsync<ProxyRouteServices> = async (app, services) => {
  app.post<{ Params: { provider: string; "*": string } }>(
    "/v1/proxy/:provider/*",
    async (request, reply) => {
      // ... previous code ...
      const upstreamUrlObj = upstreamUrl(
        services.providerBaseUrls[provider],
        wildcardPath
      );
      const requestId = randomUUID();
      const start = performance.now();
      const provider = proxyProviderSchema.parse(request.params.provider);
      const wildcardPath = request.params["*"] ?? "";
      const apiKey =
        (request.headers["x-api-key"] as string | undefined) ??
        (request.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, "");

      if (!apiKey) {
        return reply.code(401).send({ error: "Missing API key" });
      }

      const principal = await services.clientApiKeyResolver.resolve(apiKey, "proxy");
      if (!principal) {
        return reply.code(401).send({ error: "Invalid API key" });
      }

      const policyContext = {
        organizationId: principal.organizationId,
        module: "chat-protect" as const,
        action: "proxy:forward",
        provider,
        resource: `${provider}/${wildcardPath}`,
        metadata: {},
        detections: [],
      };

      const snapshot = await services.policySnapshots.get(principal.organizationId);
      if (snapshot) {
        const decision = evaluatePolicy(snapshot, policyContext);
        if (decision.effect === "BLOCK") {
          const event: AuditEvent = {
            requestId,
            organizationId: principal.organizationId,
            apiKeyId: principal.apiKeyId,
            provider,
            decision: "block",
            policyId: snapshot.policyId,
            policyVersionId: snapshot.policyVersionId,
            detectionCounts: {},
            status: "blocked",
            eventType: "proxy",
            overheadMs: Math.round(performance.now() - start),
            createdAt: new Date().toISOString(),
          };
          await services.audit?.record(event);
          return reply.code(403).send({ error: "Request blocked by policy" });
        }
      }

      const rawBody = request.body;
      if (!rawBody || typeof rawBody !== "object") {
        return reply.code(400).send({ error: "Request body is required" });
      }

      const tokenizeTypes: readonly SensitiveEntityType[] = ["email", "phone", "person", "payment_card", "private_key"];
      const inspection = await inspectPayload(rawBody, services.detector, requestId);
      const sanitized = tokenizePayload(inspection, tokenizeTypes);

      if (sanitized.mapping && Object.keys(sanitized.mapping).length > 0) {
        await services.tokenStore.put(requestId, sanitized.mapping);
      }

      const upstreamResponse = await services.upstream.forward({
        url: upstreamUrlObj,
        headers: {
          "content-type": "application/json",
          authorization: (request.headers.authorization as string) ?? "",
        },
        body: sanitized.payload,
      });

      const storedMapping = await services.tokenStore.take(requestId);
      const resolvedBody = storedMapping
        ? reversePayload(upstreamResponse.body, storedMapping)
        : upstreamResponse.body;

      const overheadMs = Math.round(performance.now() - start);
      const event: AuditEvent = {
        requestId,
        organizationId: principal.organizationId,
        apiKeyId: principal.apiKeyId,
        provider,
        decision: "allow",
        policyId: snapshot?.policyId ?? "",
        policyVersionId: snapshot?.policyVersionId ?? "",
        detectionCounts: sanitized.counts,
        status: upstreamResponse.statusCode < 500 ? "success" : "error",
        eventType: "proxy",
        upstreamStatus: upstreamResponse.statusCode,
        overheadMs,
        createdAt: new Date().toISOString(),
      };
      await services.audit?.record(event);

      return reply.code(upstreamResponse.statusCode).send(resolvedBody);
    },
  );
};

export default proxyRoutes;
