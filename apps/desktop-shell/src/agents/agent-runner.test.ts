import { describe, expect, it, vi } from "vitest";

import { AgentRunner } from "./agent-runner";

function createMockModelRouter(responseContent = "analysis result") {
  return {
    generate: vi.fn().mockImplementation((input: { model: string }) => Promise.resolve({
      content: responseContent,
      model: input.model,
      latencyMs: 100,
    })),
    stream: vi.fn(),
  };
}

function createMockShield() {
  return {
    sanitize: vi.fn().mockReturnValue({ sanitizedText: "sanitized", mappings: [{ token: "[T_0]", original: "secret", type: "email" }] }),
    restore: vi.fn().mockReturnValue("restored"),
  };
}

const baseAgent = {
  role: "builder",
  name: "Builder",
  model: "claude-sonnet-4-6",
  systemPrompt: "You are a builder.",
};

const baseTask = {
  id: "task-1",
  input: "Fix the bug",
  agentRole: "builder",
  status: "pending" as const,
  targetPaths: ["src/app.ts"],
  relatedFiles: [],
};

const baseContext = {
  rootPath: "/project",
  files: [{ path: "src/app.ts", content: "code here", tokens: 10 }],
  usedTokens: 10,
};

describe("AgentRunner", () => {
  it("runs agent and returns completed task with output", async () => {
    const router = createMockModelRouter();
    const shield = createMockShield();
    const runner = new AgentRunner(router as never, shield as never);

    const result = await runner.run({
      agent: baseAgent as never,
      task: baseTask as never,
      repositoryContext: baseContext as never,
      privacyEnabled: false,
    });

    expect(result.status).toBe("completed");
    expect(result.output).toBeTruthy();
    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
    expect(result.creditsUsed).toBeGreaterThanOrEqual(0);
  });

  it("calls modelRouter.generate with correct params", async () => {
    const router = createMockModelRouter();
    const runner = new AgentRunner(router as never, createMockShield() as never);

    await runner.run({
      agent: baseAgent as never,
      task: baseTask as never,
      repositoryContext: baseContext as never,
      privacyEnabled: false,
    });

    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({
  model: "claude-sonnet-4-6",
        systemPrompt: "You are a builder.",
      }),
    );
  });

  it("sanitizes prompt when privacy is enabled", async () => {
    const router = createMockModelRouter();
    const shield = createMockShield();
    const runner = new AgentRunner(router as never, shield as never);

    await runner.run({
      agent: baseAgent as never,
      task: baseTask as never,
      repositoryContext: baseContext as never,
      privacyEnabled: true,
    });

    expect(shield.sanitize).toHaveBeenCalled();
    expect(shield.restore).toHaveBeenCalled();
  });

  it("skips sanitize/restore when privacy is disabled", async () => {
    const router = createMockModelRouter();
    const shield = createMockShield();
    const runner = new AgentRunner(router as never, shield as never);

    await runner.run({
      agent: baseAgent as never,
      task: baseTask as never,
      repositoryContext: baseContext as never,
      privacyEnabled: false,
    });

    expect(shield.sanitize).not.toHaveBeenCalled();
    expect(shield.restore).not.toHaveBeenCalled();
  });

  it("returns zero credits for local/ollama models", async () => {
    const router = createMockModelRouter();
    const runner = new AgentRunner(router as never, createMockShield() as never);

    const result = await runner.run({
      agent: { ...baseAgent, model: "ollama/llama3" } as never,
      task: baseTask as never,
      repositoryContext: baseContext as never,
      privacyEnabled: false,
    });

    expect(result.creditsUsed).toBe(0);
  });

  it("builds prompt containing agent role, task input, and file context", async () => {
    const router = createMockModelRouter();
    const runner = new AgentRunner(router as never, createMockShield() as never);

    await runner.run({
      agent: baseAgent as never,
      task: baseTask as never,
      repositoryContext: baseContext as never,
      privacyEnabled: false,
    });

    const callArgs = router.generate.mock.calls[0]![0]!;
    const userMessage = callArgs.userMessage;
    expect(userMessage).toContain('role="builder"');
    expect(userMessage).toContain("Fix the bug");
    expect(userMessage).toContain("src/app.ts");
  });
});
