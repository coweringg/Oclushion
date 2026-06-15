import { describe, expect, it } from "vitest";

import { SessionUsageService } from "./session-usage.service";

describe("SessionUsageService", () => {
  it("starts with zero counters", () => {
    const service = new SessionUsageService();
    expect(service.getSnapshot()).toEqual({ creditsUsed: 0, tokensSent: 0, promptsCount: 0 });
  });

  it("accumulates tokens and credits across prompts", () => {
    const service = new SessionUsageService();
    service.recordPrompt(100, 5);
    service.recordPrompt(200, 10);
    expect(service.getSnapshot()).toEqual({ creditsUsed: 15, tokensSent: 300, promptsCount: 2 });
  });

  it("clamps negative values to zero", () => {
    const service = new SessionUsageService();
    service.recordPrompt(-50, -10);
    expect(service.getSnapshot()).toEqual({ creditsUsed: 0, tokensSent: 0, promptsCount: 1 });
  });

  it("rounds fractional inputs", () => {
    const service = new SessionUsageService();
    service.recordPrompt(150.7, 2.3);
    expect(service.getSnapshot()).toEqual({ creditsUsed: 2, tokensSent: 151, promptsCount: 1 });
  });

  it("resets all counters", () => {
    const service = new SessionUsageService();
    service.recordPrompt(500, 20);
    service.reset();
    expect(service.getSnapshot()).toEqual({ creditsUsed: 0, tokensSent: 0, promptsCount: 0 });
  });
});
