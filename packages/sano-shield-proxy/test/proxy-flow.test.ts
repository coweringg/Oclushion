import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { compileSnapshot } from "@oclushion/policy-runtime";
import { gatewayBaselinePolicyRules, type PolicyRule } from "@oclushion/shared";

import { createApp } from "../src/app.js";
import type { AuditEvent, AuditSink } from "../src/audit/audit-sink.js";
import {
  CompositeDetector,
  HttpPiiDetectorClient,
  LocalSecretDetector,
} from "../src/detectors/pii-client.js";
import { StaticPolicySnapshotProvider } from "../src/policy/policy-snapshot-cache.js";
import { upstreamUrl } from "../src/routes/proxy.js";
import { InMemoryTokenMappingStore } from "../src/storage/token-mapping-store.js";
import { UndiciUpstreamClient } from "../src/upstream/upstream-client.js";

const servers = new Set<{ close(): Promise<unknown> }>();
const authorizedClientKey = "oclushion_live_test_authorized_client_key_123456789";
const organizationId = "ae22b1a6-e1fd-43f5-a43d-a0a133db41df";
const apiKeyId = "e74c10c2-3b54-405e-a806-59979d16b526";
const policyId = "889d25cf-40f6-4ac3-b3ec-57ca1c079f4d";
const policyVersionId = "d85e436a-7b39-43ce-b2e8-bc1ac44d1e79";

const clientApiKeyResolver = {
  resolve: async (apiKey: string, scope: string) =>
    apiKey === authorizedClientKey && scope === "proxy:invoke"
      ? { apiKeyId, organizationId, scopes: ["proxy:invoke"] }
      : null,
};

class CapturingAuditSink implements AuditSink {
  public readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

class FailingAuditSink implements AuditSink {
  async record(): Promise<void> {
    throw new Error("audit unavailable");
  }
}

function policySnapshots(
  rules: PolicyRule[] = gatewayBaselinePolicyRules,
) {
  return new StaticPolicySnapshotProvider(
    new Map([
      [
        organizationId,
        compileSnapshot({
          organizationId,
          policyId,
          policyVersionId,
          version: 1,
          module: "gateway-protect",
          status: "published",
          rules,
          publishedAt: "2026-05-27T12:00:00.000Z",
        }),
      ],
    ]),
  );
}

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => server.close()));
  servers.clear();
});

describe("proxy sanitization flow", () => {
  it("cannot replace an allowlisted upstream host through the forwarded path", () => {
    const url = upstreamUrl("https://api.openai.com", "//attacker.invalid/steal");

    expect(url.hostname).toBe("api.openai.com");
    expect(url.pathname).toBe("/attacker.invalid/steal");
  });

  it("sanitizes provider input and reverses provider output without leaking clear mappings", async () => {
    const pii = Fastify();
    pii.post("/v1/analyze", async (request) => {
      const payload = request.body as { requestId: string; text: string };
      const text = payload.text;
      const email = "juan@example.com";
      const start = text.indexOf(email);

      return {
        requestId: payload.requestId,
        engine: "test-detector",
        detections:
          start >= 0 ? [{ type: "email", start, end: start + email.length, confidence: 1 }] : [],
      };
    });
    await pii.listen({ port: 0, host: "127.0.0.1" });
    servers.add(pii);

    let upstreamBody: unknown;
    const upstream = Fastify();
    upstream.post("/v1/chat/completions", async (request) => {
      upstreamBody = request.body;
      return {
        choices: [{ message: { content: "Respuesta para [EMAIL_0] con [API_KEY_0]" } }],
      };
    });
    await upstream.listen({ port: 0, host: "127.0.0.1" });
    servers.add(upstream);

    const store = new InMemoryTokenMappingStore();
    const audit = new CapturingAuditSink();
    const app = createApp({
      detector: new CompositeDetector([
        new LocalSecretDetector(),
        new HttpPiiDetectorClient(pii.listeningOrigin),
      ]),
      tokenStore: store,
      upstream: new UndiciUpstreamClient(),
      providerBaseUrls: { openai: upstream.listeningOrigin, anthropic: upstream.listeningOrigin },
      clientApiKeyResolver,
      policySnapshots: policySnapshots(),
      audit,
    });
    servers.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/proxy/openai/v1/chat/completions",
      headers: {
        authorization: "Bearer test-provider-key",
        "x-sano-api-key": authorizedClientKey,
      },
      payload: {
        messages: [
          {
            role: "user",
            content: "Contacta a juan@example.com con sk-proj-abcdefghijklmnop",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(upstreamBody).toEqual({
      messages: [{ role: "user", content: "Contacta a [EMAIL_0] con [API_KEY_0]" }],
    });
    expect(response.json()).toEqual({
      choices: [
        {
          message: {
            content: "Respuesta para juan@example.com con sk-proj-abcdefghijklmnop",
          },
        },
      ],
    });
    expect(Number(response.headers["x-sano-overhead-ms"])).toBeGreaterThanOrEqual(0);
    expect(store.size).toBe(0);
    expect(audit.events).toHaveLength(1);
    expect(JSON.stringify(audit.events)).not.toContain("juan@example.com");
    expect(audit.events[0]).toMatchObject({
      organizationId,
      apiKeyId,
      decision: "TOKENIZE",
      policyVersionId,
      detectionCounts: { email: 1, api_key: 1 },
      status: "allowed",
    });
  }, 30_000);

  it("accepts the Oclushion API key header while preserving legacy Sano Shield clients", async () => {
    const upstream = Fastify();
    upstream.post("/v1/chat/completions", async () => ({
      choices: [{ message: { content: "ok" } }],
    }));
    await upstream.listen({ port: 0, host: "127.0.0.1" });
    servers.add(upstream);

    const app = createApp({
      detector: { analyze: async () => [] },
      tokenStore: new InMemoryTokenMappingStore(),
      upstream: new UndiciUpstreamClient(),
      providerBaseUrls: { openai: upstream.listeningOrigin, anthropic: upstream.listeningOrigin },
      clientApiKeyResolver,
      policySnapshots: policySnapshots(),
      audit: new CapturingAuditSink(),
    });
    servers.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/proxy/openai/v1/chat/completions",
      headers: {
        authorization: "Bearer test-provider-key",
        "x-oclushion-api-key": authorizedClientKey,
      },
      payload: { messages: [{ role: "user", content: "hello" }] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ choices: [{ message: { content: "ok" } }] });
  });

  it("blocks matching content before forwarding", async () => {
    let forwarded = false;
    const audit = new CapturingAuditSink();
    const app = createApp({
      detector: {
        analyze: async (_requestId, text) => {
          const target = "sk-proj-abcdefghijklmnop";
          const start = text.indexOf(target);
          return start >= 0
            ? [{ type: "api_key", start, end: start + target.length, confidence: 1 }]
            : [];
        },
      },
      tokenStore: new InMemoryTokenMappingStore(),
      upstream: {
        forward: async () => {
          forwarded = true;
          return { statusCode: 200, contentType: "application/json", body: { ok: true } };
        },
      },
      providerBaseUrls: {
        openai: "https://api.openai.com",
        anthropic: "https://api.anthropic.com",
      },
      clientApiKeyResolver,
      policySnapshots: policySnapshots([
        {
          id: "block-keys",
          priority: 1,
          enabled: true,
          actions: [],
          entityTypes: ["api_key"],
          effect: "BLOCK",
          conditions: [],
        },
      ]),
      audit,
    });
    servers.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/proxy/openai/v1/responses",
      headers: { "x-sano-api-key": authorizedClientKey },
      payload: { input: "No envies sk-proj-abcdefghijklmnop" },
    });

    expect(response.statusCode).toBe(403);
    expect(forwarded).toBe(false);
    expect(audit.events[0]).toMatchObject({ decision: "BLOCK", status: "blocked" });
  });

  it("fails closed before returning rehydrated content when durable audit storage fails", async () => {
    const app = createApp({
      detector: {
        analyze: async (_requestId, text) => {
          const email = "juan@example.com";
          const start = text.indexOf(email);
          return start >= 0
            ? [{ type: "email", start, end: start + email.length, confidence: 1 }]
            : [];
        },
      },
      tokenStore: new InMemoryTokenMappingStore(),
      upstream: {
        forward: async () => ({
          statusCode: 200,
          contentType: "application/json",
          body: { output: "Listo para [EMAIL_0]" },
        }),
      },
      providerBaseUrls: {
        openai: "https://api.openai.com",
        anthropic: "https://api.anthropic.com",
      },
      clientApiKeyResolver,
      policySnapshots: policySnapshots(),
      audit: new FailingAuditSink(),
    });
    servers.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/proxy/openai/v1/responses",
      headers: { "x-sano-api-key": authorizedClientKey },
      payload: { input: "Contacta a juan@example.com" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("juan@example.com");
  });

  it("rejects unconfigured provider paths before forwarding", async () => {
    const app = createApp({
      detector: { analyze: async () => [] },
      tokenStore: new InMemoryTokenMappingStore(),
      upstream: new UndiciUpstreamClient(),
      providerBaseUrls: {
        openai: "https://api.openai.com",
        anthropic: "https://api.anthropic.com",
      },
      clientApiKeyResolver,
      policySnapshots: policySnapshots(),
    });
    servers.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/proxy/arbitrary-host/v1/chat/completions",
      headers: { "x-sano-api-key": authorizedClientKey },
      payload: { input: "hello" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("forwards Anthropic provider credentials without forwarding the Sano client key", async () => {
    let forwardedHeaders: Record<string, string> | undefined;
    const app = createApp({
      detector: { analyze: async () => [] },
      tokenStore: new InMemoryTokenMappingStore(),
      upstream: {
        forward: async (input) => {
          forwardedHeaders = input.headers;
          return {
            statusCode: 200,
            contentType: "application/json",
            body: { ok: true },
          };
        },
      },
      providerBaseUrls: {
        openai: "https://api.openai.com",
        anthropic: "https://api.anthropic.com",
      },
      clientApiKeyResolver,
      policySnapshots: policySnapshots(),
    });
    servers.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/proxy/anthropic/v1/messages",
      headers: {
        "x-api-key": "anthropic-provider-token",
        "anthropic-version": "2023-06-01",
        "x-sano-api-key": authorizedClientKey,
      },
      payload: { messages: [{ role: "user", content: "hello" }] },
    });

    expect(response.statusCode).toBe(200);
    expect(forwardedHeaders).toMatchObject({
      "x-api-key": "anthropic-provider-token",
      "anthropic-version": "2023-06-01",
    });
    expect(forwardedHeaders).not.toHaveProperty("x-sano-api-key");
    expect(forwardedHeaders).not.toHaveProperty("x-sano-api-key");
  });

  it("keeps warm in-process integrated gateway overhead below the 50ms budget", async () => {
    const app = createApp({
      detector: {
        analyze: async (_requestId, text) => {
          void _requestId;
          const email = "juan@example.com";
          const start = text.indexOf(email);
          return start >= 0
            ? [{ type: "email", start, end: start + email.length, confidence: 1 }]
            : [];
        },
      },
      tokenStore: new InMemoryTokenMappingStore(),
      upstream: {
        forward: async (input) => ({
          statusCode: 200,
          contentType: "application/json",
          body: input.body,
        }),
      },
      providerBaseUrls: {
        openai: "https://api.openai.com",
        anthropic: "https://api.anthropic.com",
      },
      clientApiKeyResolver,
      policySnapshots: policySnapshots(),
    });
    servers.add(app);

    const overheads: number[] = [];
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/proxy/openai/v1/responses",
        headers: { "x-sano-api-key": authorizedClientKey },
        payload: { input: "Contacta a juan@example.com" },
      });
      overheads.push(Number(response.headers["x-sano-overhead-ms"]));
    }

    const measured = overheads.slice(5).sort((left, right) => left - right);
    const p95 = measured[Math.ceil(measured.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
    expect(p95).toBeLessThan(50);
  });

  it("rejects proxy requests without an authorized Sano client key", async () => {
    const app = createApp({
      detector: { analyze: async () => [] },
      tokenStore: new InMemoryTokenMappingStore(),
      upstream: {
        forward: async () => ({
          statusCode: 200,
          contentType: "application/json",
          body: { ok: true },
        }),
      },
      providerBaseUrls: {
        openai: "https://api.openai.com",
        anthropic: "https://api.anthropic.com",
      },
      clientApiKeyResolver,
      policySnapshots: policySnapshots(),
    });
    servers.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/proxy/openai/v1/responses",
      headers: { "x-sano-api-key": "oclushion_live_invalid_client_key_000000000000" },
      payload: { input: "hello" },
    });

    expect(response.statusCode).toBe(401);
  });
});
