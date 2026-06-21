import { describe, expect, it, vi } from "vitest";

vi.mock("../crypto/hmac", () => ({
  computeHmacSync: vi.fn(() => "a".repeat(64)),
}));

import type { PackedRepositoryContext } from "../context.service";
import { SanoShield } from "../sano-shield.service";
import { AgentRegistry } from "./agent-registry";
import { AgentRunner } from "./agent-runner";
import { FileOwnershipService } from "./file-ownership.service";
import { AgentOrchestrator } from "./agent-orchestrator";

const context: PackedRepositoryContext = {
  files: [
    {
      path: "src/auth.ts",
      content: "export const owner = 'admin@secretcorp.com';",
      tokenEstimate: 12,
      relevanceScore: 1,
    },
  ],
  usedTokens: 12,
  tokenLimit: 128_000,
  droppedFiles: 0,
};

describe("AgentOrchestrator", () => {
  it("runs the production agent pipeline and quarantines proposals through Safe Diff", async () => {
    const seenPrompts: string[] = [];
    const runner = new AgentRunner(
      {
        generate: async (request) => {
          seenPrompts.push(request.userMessage);
          return {
            id: "test-response",
            provider: "test",
            model: request.model,
            content: "Apply this safely.\n```ts\nexport const patched = true;\n```",
            latencyMs: 1,
          };
        },
        async *stream(request) {
          seenPrompts.push(request.userMessage);
          yield { delta: "Apply this safely.\n```ts\nexport const patched = true;\n```", finishReason: "stop" };
        },
      },
      new SanoShield(),
      { runCommand: vi.fn(), shouldPrompt: vi.fn() } as never,
    );
    const orchestrator = new AgentOrchestrator(new AgentRegistry(), runner, new FileOwnershipService());

    const plan = await orchestrator.orchestrate({
      userRequest: "Review auth flow for admin@secretcorp.com",
      repositoryContext: context,
      targetPaths: ["src/auth.ts"],
      privacyEnabled: true,
    });

    expect(plan.tasks.length).toBeGreaterThanOrEqual(5);
    expect(plan.tasks.every((task) => task.status === "completed")).toBe(true);
    expect(plan.tasks.flatMap((task) => task.proposals)).toHaveLength(plan.tasks.length);
    expect(seenPrompts.every((prompt) => !prompt.includes("admin@secretcorp.com"))).toBe(true);
    expect(orchestrator.snapshot().activePlan).toBeNull();
    await expect(
      orchestrator.orchestrate({
        userRequest: "Run another docs pass",
        repositoryContext: context,
        privacyEnabled: false,
      }),
    ).resolves.toBeTruthy();
  });
});
