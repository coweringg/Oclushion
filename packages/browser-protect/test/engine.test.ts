import { describe, expect, it } from "vitest";

import { createBrowserAuditEvent, protectBrowserText } from "../src/index.js";

describe("Browser Protect engine", () => {
  it("tokenizes browser prompt PII locally", () => {
    const decision = protectBrowserText(
      "Contacta a ana@empresa.com con tarjeta 4111 1111 1111 1111 y key sk-proj-secretissima123",
    );

    expect(decision.effect).toBe("TOKENIZE");
    expect(decision.sanitizedText).toContain("[EMAIL_0]");
    expect(decision.sanitizedText).toContain("[PAYMENT_CARD_0]");
    expect(decision.sanitizedText).toContain("[API_KEY_0]");
    expect(decision.sanitizedText).not.toContain("ana@empresa.com");
    expect(decision.counts).toMatchObject({ email: 1, payment_card: 1, api_key: 1 });
  });

  it("creates audit events without prompt content", () => {
    const decision = protectBrowserText("ana@empresa.com");
    const event = createBrowserAuditEvent({
      organizationId: "11111111-1111-4111-8111-111111111111",
      action: "browser_prompt_submit",
      decision,
      host: "chatgpt.com",
      selector: "#prompt-textarea",
      promptLength: 15,
    });

    expect(JSON.stringify(event)).not.toContain("ana@empresa.com");
    expect(event).toMatchObject({
      module: "browser-protect",
      decision: "TOKENIZE",
      detectionCounts: { email: 1 },
    });
  });
});
