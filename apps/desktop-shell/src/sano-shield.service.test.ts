import { describe, expect, it, vi } from "vitest";

vi.mock("@oclushion/browser-protect", () => ({
  detectBrowserPii: vi.fn((text: string) => {
    const detections: Array<{ type: string; start: number; end: number }> = [];
    const emailMatch = text.match(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/u);
    if (emailMatch && emailMatch.index !== undefined) {
      detections.push({ type: "email", start: emailMatch.index, end: emailMatch.index + emailMatch[0].length });
    }
    return detections;
  }),
}));

vi.mock("./crypto/hmac", () => ({
  computeHmacSync: vi.fn(() => "a".repeat(64)),
}));

import { SanoShield } from "./sano-shield.service";

describe("SanoShield", () => {
  it("returns text unchanged when no PII detected", () => {
    const shield = new SanoShield();
    const result = shield.sanitize("Hello world");
    expect(result.sanitizedText).toBe("Hello world");
    expect(result.mappings).toEqual([]);
  });

  it("replaces email with token", () => {
    const shield = new SanoShield();
    const result = shield.sanitize("Contact john@example.com for info");
    expect(result.sanitizedText).toMatch(/⟨PII:EMAIL:[a-f0-9]+:[a-f0-9]+⟩/);
    expect(result.sanitizedText).not.toContain("john@example.com");
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0]?.original).toBe("john@example.com");
    expect(result.mappings[0]?.type).toBe("email");
  });

  it("restores original text from mappings", () => {
    const shield = new SanoShield();
    const sanitized = "Contact ⟨PII:EMAIL:abcd1234⟩ for info";
    const mappings = [{ token: "⟨PII:EMAIL:abcd1234⟩", original: "john@example.com", type: "email" }];
    const restored = shield.restore(sanitized, mappings);
    expect(restored).toBe("Contact john@example.com for info");
  });

  it("handles multiple PII tokens in restore order", () => {
    const shield = new SanoShield();
    const text = "Email ⟨PII:EMAIL:abcd⟩ and card ⟨PII:PAYMENT_CARD:ef01⟩";
    const mappings = [
      { token: "⟨PII:EMAIL:abcd⟩", original: "a@b.com", type: "email" },
      { token: "⟨PII:PAYMENT_CARD:ef01⟩", original: "4111-1111-1111-1111", type: "payment_card" },
    ];
    expect(shield.restore(text, mappings)).toBe("Email a@b.com and card 4111-1111-1111-1111");
  });

  it("restore is idempotent with empty mappings", () => {
    const shield = new SanoShield();
    expect(shield.restore("unchanged", [])).toBe("unchanged");
  });
});
