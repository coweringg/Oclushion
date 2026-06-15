import { describe, expect, it } from "vitest";

import { ModelRouter } from "./model-router";
import type { ILLMProvider, LLMGenerateRequest, LLMGenerateResponse, StreamChunk } from "./provider";

class MockProvider implements ILLMProvider {
  public readonly id: string;
  private readonly chunks: StreamChunk[];

  public constructor(id: string, chunks: StreamChunk[]) {
    this.id = id;
    this.chunks = chunks;
  }

  public supports(_model: string): boolean {
    return true;
  }

  public async generate(_request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const content = this.chunks.map((c) => c.delta).join("");
    return {
      provider: this.id,
      model: "mock",
      content,
      latencyMs: 0,
    };
  }

  public async *stream(_request: LLMGenerateRequest): AsyncIterable<StreamChunk> {
    for (const chunk of this.chunks) {
      yield chunk;
    }
  }
}

describe("ModelRouter", () => {
  it("routes Claude models to Anthropic", () => {
    const router = new ModelRouter();

    expect(router.resolveProvider("claude-opus-4-8").id).toBe("anthropic");
    expect(router.resolveProvider("claude-sonnet-4-6").id).toBe("anthropic");
    expect(router.resolveProvider("claude-3-5-sonnet").id).toBe("anthropic");
  });

  it("routes GPT models to OpenAI", () => {
    const router = new ModelRouter();

    expect(router.resolveProvider("gpt-5.5").id).toBe("openai");
    expect(router.resolveProvider("gpt-5.4-mini").id).toBe("openai");
    expect(router.resolveProvider("gpt-4.1").id).toBe("openai");
  });

  it("routes future custom OpenAI and Anthropic ids by provider prefix", () => {
    const router = new ModelRouter();

    expect(router.resolveProvider("gpt-5.5-pro").id).toBe("openai");
    expect(router.resolveProvider("claude-opus-4-8").id).toBe("anthropic");
  });

  it("routes local and ollama models to Ollama", () => {
    const router = new ModelRouter();

    expect(router.resolveProvider("local/llama3.1").id).toBe("ollama");
    expect(router.resolveProvider("ollama/codellama").id).toBe("ollama");
  });

  it("stream() returns an async iterable of chunks", async () => {
    const chunks: StreamChunk[] = [
      { delta: "Hello" },
      { delta: " " },
      { delta: "world", finishReason: "stop" },
    ];
    const provider = new MockProvider("mock", chunks);
    const router = new ModelRouter({ providers: [provider] });

    const collected: StreamChunk[] = [];
    for await (const chunk of router.stream({
      model: "mock-model",
      systemPrompt: "test",
      userMessage: "test",
    })) {
      collected.push(chunk);
    }

    expect(collected).toHaveLength(3);
    expect(collected[0]?.delta).toBe("Hello");
    expect(collected[1]?.delta).toBe(" ");
    expect(collected[2]?.delta).toBe("world");
    expect(collected[2]?.finishReason).toBe("stop");
  });

  it("stream() accumulates content correctly", async () => {
    const chunks: StreamChunk[] = [
      { delta: "The " },
      { delta: "answer " },
      { delta: "is " },
      { delta: "42." },
    ];
    const provider = new MockProvider("mock", chunks);
    const router = new ModelRouter({ providers: [provider] });

    let content = "";
    for await (const chunk of router.stream({
      model: "mock-model",
      systemPrompt: "test",
      userMessage: "test",
    })) {
      content += chunk.delta;
    }

    expect(content).toBe("The answer is 42.");
  });
});
