import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { type FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";

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
  const sanitizedPath = path.replace(/^\/{2,}/, "/");
  return new URL(sanitizedPath, base.replace(/\/+$/, "") + "/");
}

const proxyRoutes: FastifyPluginAsync<ProxyRouteServices> = async (app, services) => {
  app.post<{ Params: { provider: string; "*": string } }>(
    "/v1/proxy/:provider/*",
    async (request, reply) => {
      const requestId = randomUUID();
      const start = performance.now();

      let provider: ProxyProvider;
      try {
        provider = proxyProviderSchema.parse(request.params.provider);
      } catch (err) {
        if (err instanceof ZodError) {
          return reply.code(404).send({ error: `Unconfigured provider: ${request.params.provider}` });
        }
        throw err;
      }

      const wildcardPath = request.params["*"] ?? "";
      const upstreamUrlObj = upstreamUrl(
        services.providerBaseUrls[provider],
        wildcardPath
      );
      const apiKey =
        (request.headers["x-sano-api-key"] as string | undefined) ??
        (request.headers["x-oclushion-api-key"] as string | undefined) ??
        (request.headers["x-api-key"] as string | undefined) ??
        (request.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, "");

      if (!apiKey) {
        return reply.code(401).send({ error: "Missing API key" });
      }

      const principal = await services.clientApiKeyResolver.resolve(apiKey, "proxy:invoke");
      if (!principal) {
        return reply.code(401).send({ error: "Invalid API key" });
      }

      const rawBody = request.body;
      if (!rawBody || typeof rawBody !== "object") {
        return reply.code(400).send({ error: "Request body is required" });
      }

      const tokenizeTypes: readonly SensitiveEntityType[] = ["email", "phone", "person", "payment_card", "private_key", "api_key", "bank_account", "access_token"];
      const inspection = await inspectPayload(rawBody, services.detector, requestId);
      const sanitized = tokenizePayload(inspection, tokenizeTypes);

      const hasTokenization = sanitized.mapping && Object.keys(sanitized.mapping).length > 0;

      const policyContext = {
        organizationId: principal.organizationId,
        module: "gateway-protect" as const,
        action: "provider_request",
        provider,
        resource: `${provider}/${wildcardPath}`,
        metadata: {},
        detections: inspection.detections,
      };

      const snapshot = await services.policySnapshots.get(principal.organizationId);
      const overheadMs = Math.round(performance.now() - start);

      if (snapshot) {
        const decision = evaluatePolicy(snapshot, policyContext);
        if (decision.effect === "BLOCK") {
          const event: AuditEvent = {
            requestId,
            organizationId: principal.organizationId,
            apiKeyId: principal.apiKeyId,
            provider,
            decision: "BLOCK",
            policyId: snapshot.policyId,
            policyVersionId: snapshot.policyVersionId,
            detectionCounts: sanitized.counts,
            status: "blocked",
            eventType: "proxy",
            overheadMs,
            createdAt: new Date(),
          };
          try {
            await services.audit?.record(event);
          } catch {
            return reply.code(503).send({ error: "Audit storage unavailable" });
          }
          reply.header("x-sano-overhead-ms", overheadMs);
          return reply.code(403).send({ error: "Request blocked by policy" });
        }
      }

      if (hasTokenization) {
        await services.tokenStore.put(requestId, sanitized.mapping!);
      }

      const stripHeaders = new Set(["host", "x-sano-api-key", "x-oclushion-api-key", "content-length", "user-agent", "connection"]);
      const upstreamResponse = await services.upstream.forward({
        url: upstreamUrlObj,
        headers: Object.fromEntries(
          Object.entries(request.headers)
            .filter(([key]) => !stripHeaders.has(key))
            .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value ?? "")]),
        ),
        body: sanitized.payload,
      });

      const storedMapping = await services.tokenStore.take(requestId);
      const resolvedBody = storedMapping
        ? reversePayload(upstreamResponse.body, storedMapping)
        : upstreamResponse.body;

      const event: AuditEvent = {
        requestId,
        organizationId: principal.organizationId,
        apiKeyId: principal.apiKeyId,
        provider,
        decision: hasTokenization ? "TOKENIZE" : "ALLOW",
        policyId: snapshot?.policyId ?? "",
        policyVersionId: snapshot?.policyVersionId ?? "",
        detectionCounts: sanitized.counts,
        status: upstreamResponse.statusCode < 500 ? "allowed" : "failed",
        eventType: "proxy",
        upstreamStatus: upstreamResponse.statusCode,
        overheadMs,
        createdAt: new Date(),
      };
      try {
        await services.audit?.record(event);
      } catch {
        return reply.code(503).send({ error: "Audit storage unavailable" });
      }

      reply.header("x-sano-overhead-ms", overheadMs);
      return reply.code(upstreamResponse.statusCode).send(resolvedBody);
    },
  );
};

export default proxyRoutes;
