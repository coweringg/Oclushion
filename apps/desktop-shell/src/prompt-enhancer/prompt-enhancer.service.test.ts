import { describe, expect, it, vi } from "vitest";

vi.mock("../crypto/hmac", () => ({
  computeHmacSync: vi.fn(() => "a".repeat(64)),
}));

import { createMockRepoScanResult } from "../repo-scanner";
import { SanoShield } from "../sano-shield.service";
import { PromptEnhancerService } from "./prompt-enhancer.service";

describe("PromptEnhancerService", () => {
  it("sanitizes the user prompt before model enhancement and restores output", async () => {
    let capturedUserMessage = "";
    const service = new PromptEnhancerService(
      {
        generate: async (request) => {
          capturedUserMessage = request.userMessage;
          return {
            id: "enhanced",
            provider: "test",
            model: request.model,
            latencyMs: 1,
            content: "# Requerimiento: Mejorar auth\n\n## Objetivo\nValidar flujo.",
          };
        },
        async *stream(request) {
          capturedUserMessage = request.userMessage;
          yield { delta: "# Requerimiento: Mejorar auth\n\n## Objetivo\nValidar flujo.", finishReason: "stop" };
        },
      },
      new SanoShield(),
      async () => "export function login() {}",
    );

    const enhanced = await service.enhance({
      basicPrompt: "mejora login de admin@secretcorp.com",
      repo: createMockRepoScanResult(),
      model: "gpt-5.4-mini",
      activeFilePath: "src/auth.ts",
    });

    expect(capturedUserMessage).toMatch(/⟨PII:EMAIL/);
    expect(capturedUserMessage).not.toContain("admin@secretcorp.com");
    expect(enhanced).toContain("## Objetivo");
  });
});
