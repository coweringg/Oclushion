import { describe, expect, it, vi } from "vitest";

vi.mock("./crypto/hmac", () => ({
  computeHmacSync: vi.fn(() => "a".repeat(64)),
}));

import { runOclushionChatTurn } from "./chat-orchestrator";
import { packRepositoryContext, createMockSourceFiles } from "./context.service";
import { PromptBuilder } from "./prompt-builder";
import { createMockRepoScanResult } from "./repo-scanner";
import { SanoShield } from "./sano-shield.service";
import { mockSkillpacks } from "./skillpacks/skillpack.manager";
import type { LLMGenerateRequest, LLMGenerateResponse, StreamChunk } from "./llm/provider";

describe("Sano Shield chat orchestration", () => {
  it("sanitizes outbound prompts and restores provider tokens before rendering", async () => {
    const capturedRequests: LLMGenerateRequest[] = [];
    const fakeRouter = {
      async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
        capturedRequests.push(request);
        return {
          provider: "test",
          model: request.model,
          latencyMs: 1,
          content: `Reviewed account ${request.userMessage}`,
        };
      },
      async *stream(request: LLMGenerateRequest): AsyncIterable<StreamChunk> {
        capturedRequests.push(request);
        yield { delta: `Reviewed account ${request.userMessage}`, finishReason: "stop" };
      },
    };

    const result = await runOclushionChatTurn({
      userMessage: "Please review admin@secretcorp.com auth flow.",
      model: "gpt-5.5",
      skillpack: mockSkillpacks[0]!,
      repo: createMockRepoScanResult(),
      repositoryContext: packRepositoryContext(createMockSourceFiles(), 1_000),
      promptBuilder: new PromptBuilder(),
      modelRouter: fakeRouter,
      sanoShield: new SanoShield(),
      privacyEnabled: true,
    });

    const capturedRequest = capturedRequests[0]!;
    expect(capturedRequest.systemPrompt).toMatch(/⟨PII:EMAIL/);
    expect(capturedRequest.systemPrompt).not.toContain("admin@secretcorp.com");
    expect(capturedRequest.userMessage).toMatch(/⟨PII:EMAIL/);
    expect(capturedRequest.userMessage).not.toContain("admin@secretcorp.com");
    expect(result.restoredContent).toContain("admin@secretcorp.com");
  });

  it("sanitizes recent chat history before sending it to a provider", async () => {
    const capturedRequests: LLMGenerateRequest[] = [];
    const fakeRouter = {
      async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
        capturedRequests.push(request);
        return {
          provider: "test",
          model: request.model,
          latencyMs: 1,
          content: "History reviewed.",
        };
      },
      async *stream(request: LLMGenerateRequest): AsyncIterable<StreamChunk> {
        capturedRequests.push(request);
        yield { delta: "History reviewed.", finishReason: "stop" };
      },
    };

    const result = await runOclushionChatTurn({
      userMessage: "Use the prior context.",
      model: "gpt-5.5",
      skillpack: mockSkillpacks[0]!,
      repo: createMockRepoScanResult(),
      repositoryContext: packRepositoryContext(createMockSourceFiles(), 1_000),
      promptBuilder: new PromptBuilder(),
      modelRouter: fakeRouter,
      sanoShield: new SanoShield(),
      privacyEnabled: true,
      historyMessages: [
        {
          role: "user",
          content: "Earlier incident involved billing-admin@secretcorp.com.",
        },
      ],
    });

    const capturedRequest = capturedRequests[0]!;
    expect(JSON.stringify(capturedRequest.messages)).toMatch(/⟨PII:EMAIL/);
    expect(JSON.stringify(capturedRequest.messages)).not.toContain("billing-admin@secretcorp.com");
  });
});
