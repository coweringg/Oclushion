import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { compileSnapshot, evaluatePolicy } from "../src/index.js";

const organizationId = "ae22b1a6-e1fd-43f5-a43d-a0a133db41df";
const policyId = "889d25cf-40f6-4ac3-b3ec-57ca1c079f4d";
const policyVersionId = "d85e436a-7b39-43ce-b2e8-bc1ac44d1e79";

function snapshot() {
  return compileSnapshot({
    organizationId,
    policyId,
    policyVersionId,
    version: 1,
    module: "gateway-protect",
    status: "published",
    rules: [
      { id: "email", priority: 20, entityTypes: ["email"], effect: "TOKENIZE" },
      { id: "key-block", priority: 10, entityTypes: ["private_key"], effect: "BLOCK" },
    ],
    publishedAt: "2026-05-27T12:00:00.000Z",
  });
}

describe("policy runtime", () => {
  it("evaluates matching rules in deterministic priority order", () => {
    const decision = evaluatePolicy(snapshot(), {
      organizationId,
      module: "gateway-protect",
      action: "provider_request",
      metadata: {},
      detections: [
        { type: "email", confidence: 1 },
        { type: "private_key", confidence: 1 },
      ],
    });

    expect(decision).toEqual({
      effect: "BLOCK",
      matchedRuleIds: ["key-block", "email"],
      tokenizeEntityTypes: [],
      policyVersionId,
      reasonCode: "rule_matched",
      requiresMapping: false,
    });
  });

  it("tokenizes matching PII and leaves unmatched content allowed", () => {
    expect(
      evaluatePolicy(snapshot(), {
        organizationId,
        module: "gateway-protect",
        action: "provider_request",
        metadata: {},
        detections: [{ type: "email", confidence: 1 }],
      }),
    ).toMatchObject({ effect: "TOKENIZE", tokenizeEntityTypes: ["email"], requiresMapping: true });

    expect(
      evaluatePolicy(snapshot(), {
        organizationId,
        module: "gateway-protect",
        action: "provider_request",
        metadata: {},
        detections: [],
      }).effect,
    ).toBe("ALLOW");
  });

  it("fails closed when a snapshot is applied outside its tenant boundary", () => {
    const decision = evaluatePolicy(snapshot(), {
      organizationId: "08cb80b2-a70e-42a2-88ab-29fc7bfebea2",
      module: "gateway-protect",
      action: "provider_request",
      metadata: {},
      detections: [{ type: "email", confidence: 1 }],
    });

    expect(decision.effect).toBe("BLOCK");
    expect(decision.tokenizeEntityTypes).toEqual([]);
    expect(decision.reasonCode).toBe("snapshot_scope_mismatch");
  });

  it("does not let an allow rule expose content covered by a restrictive rule", () => {
    const mixed = compileSnapshot({
      organizationId,
      policyId,
      policyVersionId,
      version: 2,
      module: "gateway-protect",
      status: "published",
      rules: [
        { id: "allow-email", priority: 1, entityTypes: ["email"], effect: "ALLOW" },
        { id: "tokenize-card", priority: 20, entityTypes: ["payment_card"], effect: "TOKENIZE" },
      ],
      publishedAt: "2026-05-27T12:00:00.000Z",
    });

    const decision = evaluatePolicy(mixed, {
      organizationId,
      module: "gateway-protect",
      action: "provider_request",
      metadata: {},
      detections: [
        { type: "email", confidence: 1 },
        { type: "payment_card", confidence: 1 },
      ],
    });

    expect(decision).toMatchObject({
      effect: "TOKENIZE",
      matchedRuleIds: ["allow-email", "tokenize-card"],
      tokenizeEntityTypes: ["payment_card"],
    });
  });

  it("evaluates a compiled snapshot with negligible local overhead", () => {
    const compiled = snapshot();
    const context = {
      organizationId,
      module: "gateway-protect" as const,
      action: "provider_request",
      metadata: {},
      detections: [{ type: "email" as const, confidence: 1 }],
    };
    const samples: number[] = [];

    for (let attempt = 0; attempt < 2_000; attempt += 1) {
      const startedAt = performance.now();
      evaluatePolicy(compiled, context);
      samples.push(performance.now() - startedAt);
    }

    const measured = samples.slice(100).sort((left, right) => left - right);
    const p95 = measured[Math.ceil(measured.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
    expect(p95).toBeLessThan(5);
  });
});
