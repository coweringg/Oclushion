import { describe, expect, it } from "vitest";

import { decodeLicenseToken, normalizeTier } from "./license-validator";

function makeToken(payload: Record<string, unknown>, signature = "sig123"): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.${signature}`;
}

describe("decodeLicenseToken", () => {
  it("decodes valid token with all fields", () => {
    const token = makeToken({ sub: "usr_1", plan: "pro", status: "active", exp: 1751884800 });
    const decoded = decodeLicenseToken(token);
    expect(decoded.userId).toBe("usr_1");
    expect(decoded.plan).toBe("pro");
    expect(decoded.status).toBe("active");
    expect(decoded.signatureVerified).toBe(false);
    expect(decoded.expiresAt).toBeDefined();
  });

  it("falls back to userId field when sub is missing", () => {
    const token = makeToken({ userId: "usr_2", tier: "team" });
    const decoded = decodeLicenseToken(token);
    expect(decoded.userId).toBe("usr_2");
    expect(decoded.plan).toBe("team");
  });

  it("returns undefined for missing/unknown status", () => {
    const token = makeToken({ sub: "u1", status: "unknown_value" });
    expect(decodeLicenseToken(token).status).toBeUndefined();
  });

  it("returns undefined expiresAt when exp is not a number", () => {
    const token = makeToken({ sub: "u1", exp: "not-a-number" });
    expect(decodeLicenseToken(token).expiresAt).toBeUndefined();
  });

  it("uses expiresAt string when exp is missing", () => {
    const token = makeToken({ sub: "u1", expiresAt: "2026-12-31" });
    expect(decodeLicenseToken(token).expiresAt).toBe("2026-12-31");
  });

  it("signatureVerified is always false (client cannot verify)", () => {
    const token = makeToken({ sub: "u1" }, "");
    expect(decodeLicenseToken(token).signatureVerified).toBe(false);
  });

  it("signatureVerified is false even when signature is present", () => {
    const token = makeToken({ sub: "u1" }, "real-signature");
    expect(decodeLicenseToken(token).signatureVerified).toBe(false);
  });

  it("throws on invalid token format", () => {
    expect(() => decodeLicenseToken("invalid")).toThrow();
  });

  it("throws when payload is missing", () => {
    expect(() => decodeLicenseToken("header.")).toThrow("Invalid license token");
  });
});

describe("normalizeTier", () => {
  it("returns pro for 'pro'", () => {
    expect(normalizeTier("pro")).toBe("pro");
  });

  it("returns enterprise for 'team', 'teams', 'enterprise'", () => {
    expect(normalizeTier("team")).toBe("enterprise");
    expect(normalizeTier("teams")).toBe("enterprise");
    expect(normalizeTier("enterprise")).toBe("enterprise");
  });

  it("returns free for unknown strings", () => {
    expect(normalizeTier("unknown")).toBe("free");
  });

  it("returns free for non-string input", () => {
    expect(normalizeTier(123)).toBe("free");
    expect(normalizeTier(null)).toBe("free");
    expect(normalizeTier(undefined)).toBe("free");
  });

  it("is case-insensitive", () => {
    expect(normalizeTier("PRO")).toBe("pro");
    expect(normalizeTier("Team")).toBe("enterprise");
  });
});
