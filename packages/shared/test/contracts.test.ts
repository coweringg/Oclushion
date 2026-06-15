import { describe, expect, it } from "vitest";

import {
  analyzeTextRequestSchema,
  detectionSchema,
  platformAuditEventSchema,
  chatBaselinePolicyRules,
  gatewayPrincipalSchema,
  gatewayBaselinePolicyRules,
  policyDecisionSchema,
  policyEvaluationContextSchema,
  policySnapshotSchema,
  proxyProviderSchema,
} from "../src/index.js";

describe("shared detector contracts", () => {
  it("rejects detection offsets without an end position", () => {
    const result = detectionSchema.safeParse({
      type: "email",
      start: 4,
      end: 0,
      confidence: 0.95,
    });

    expect(result.success).toBe(false);
  });

  it("defaults analysis languages to Spanish and English", () => {
    const request = analyzeTextRequestSchema.parse({ requestId: "request-1", text: "hola" });

    expect(request.languages).toEqual(["es", "en"]);
  });

  it("only accepts configured provider adapters", () => {
    expect(proxyProviderSchema.safeParse("openai").success).toBe(true);
    expect(proxyProviderSchema.safeParse("arbitrary-host").success).toBe(false);
  });

  it("requires policy evaluations to carry a valid tenant boundary", () => {
    const context = policyEvaluationContextSchema.parse({
      organizationId: "ae22b1a6-e1fd-43f5-a43d-a0a133db41df",
      module: "gateway-protect",
      action: "provider_request",
      detections: [{ type: "email", confidence: 1 }],
    });

    expect(context.organizationId).toBe("ae22b1a6-e1fd-43f5-a43d-a0a133db41df");
    expect(
      policyEvaluationContextSchema.safeParse({
        organizationId: "not-an-organization",
        module: "gateway-protect",
        action: "provider_request",
      }).success,
    ).toBe(false);
  });

  it("validates published policy snapshots with structured rules", () => {
    const snapshot = policySnapshotSchema.parse({
      organizationId: "ae22b1a6-e1fd-43f5-a43d-a0a133db41df",
      policyId: "889d25cf-40f6-4ac3-b3ec-57ca1c079f4d",
      policyVersionId: "d85e436a-7b39-43ce-b2e8-bc1ac44d1e79",
      version: 1,
      module: "gateway-protect",
      status: "published",
      rules: [{ id: "email", effect: "TOKENIZE", entityTypes: ["email"] }],
      publishedAt: "2026-05-27T12:00:00.000Z",
    });

    expect(snapshot.rules[0]).toMatchObject({ priority: 100, enabled: true, actions: [] });
  });

  it("keeps raw sensitive values out of platform audit contracts", () => {
    const event = {
      eventId: "e74c10c2-3b54-405e-a806-59979d16b526",
      organizationId: "ae22b1a6-e1fd-43f5-a43d-a0a133db41df",
      module: "gateway-protect",
      action: "provider_request",
      eventType: "policy.decision",
      status: "allowed",
      occurredAt: "2026-05-27T12:00:00.000Z",
      metadata: { originalPrompt: "juan@example.com" },
    };

    expect(platformAuditEventSchema.safeParse(event).success).toBe(false);
  });

  it("validates tenant-aware gateway principals and selective policy decisions", () => {
    expect(
      gatewayPrincipalSchema.parse({
        apiKeyId: "e74c10c2-3b54-405e-a806-59979d16b526",
        organizationId: "ae22b1a6-e1fd-43f5-a43d-a0a133db41df",
        scopes: ["proxy:invoke"],
      }).organizationId,
    ).toBe("ae22b1a6-e1fd-43f5-a43d-a0a133db41df");

    expect(
      policyDecisionSchema.parse({
        effect: "TOKENIZE",
        matchedRuleIds: ["card"],
        tokenizeEntityTypes: ["payment_card"],
        policyVersionId: "d85e436a-7b39-43ce-b2e8-bc1ac44d1e79",
        reasonCode: "rule_matched",
        requiresMapping: true,
      }).tokenizeEntityTypes,
    ).toEqual(["payment_card"]);
  });

  it("ships a baseline gateway policy that preserves existing tokenization coverage", () => {
    expect(gatewayBaselinePolicyRules).toEqual([
      expect.objectContaining({
        id: "gateway-baseline-tokenize-sensitive-data",
        effect: "TOKENIZE",
        entityTypes: expect.arrayContaining(["email", "payment_card", "api_key", "private_key"]),
      }),
    ]);
  });

  it("ships a baseline chat policy for non-streaming protected prompts", () => {
    expect(chatBaselinePolicyRules).toEqual([
      expect.objectContaining({
        id: "chat-baseline-tokenize-sensitive-data",
        actions: ["chat_message"],
        effect: "TOKENIZE",
        entityTypes: expect.arrayContaining(["email", "payment_card", "api_key", "private_key"]),
      }),
    ]);
  });
});
