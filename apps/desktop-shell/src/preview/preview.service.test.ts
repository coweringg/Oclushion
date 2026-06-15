import { describe, expect, it } from "vitest";

import { PreviewService } from "./preview.service";

describe("PreviewService", () => {
  it("attaches to an available dev server and records console logs", async () => {
    const service = new PreviewService(async (url) => url.endsWith(":5174"));

    const config = await service.startPreviewServer({
      workspacePath: "apps/vite-app",
      preferredPort: 5173,
      framework: "vite",
    });
    service.addConsoleLog({ level: "info", message: "Vite HMR Connected" });

    expect(config.url).toBe("http://localhost:5174");
    expect(service.getLogs()[0]?.message).toBe("Vite HMR Connected");
  });

  it("delegates visual verification to a model router", async () => {
    const service = new PreviewService(async () => true, async () => "base64-screenshot");
    const result = await service.verifyVisualState({
      expectedDesign: "purple CTA",
      modelRouter: {
        generate: async () => ({
          id: "qa",
          provider: "test",
          model: "gpt-5.4-mini",
          content: "FAIL\n- Button spacing differs",
          latencyMs: 1,
        }),
        async *stream() {
          yield { delta: "FAIL\n- Button spacing differs", finishReason: "stop" };
        },
      },
    });

    expect(result.passed).toBe(false);
    expect(result.issuesDetected).toContain("Button spacing differs");
  });
});
