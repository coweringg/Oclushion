import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { type FastifyPluginAsync } from "fastify";

import { evaluatePolicy } from "@oclushion/policy-runtime";
import { proxyProviderSchema, type ProxyProvider } from "@oclushion/shared";

import { NoopAuditSink, type AuditSink } from "../audit/audit-sink.js";
import type { ClientApiKeyResolver } from "../auth/client-api-key-verifier.js";
import type { TextDetector } from "../detectors/pii-client.js";
import type { PolicySnapshotProvider } from "../policy/policy-snapshot-cache.js";
import {
  inspectPayload,
  reversePayload,
  tokenizePayload,
  type TokenMapping,
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

const proxyRoutes: FastifyPluginAsync<ProxyRouteServices> = async (app, services) => {
  app.post<{ Params: { provider: string; "*": string } }>(
    "/v1/proxy/:provider