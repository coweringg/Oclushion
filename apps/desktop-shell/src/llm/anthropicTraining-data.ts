import {
  requireProviderKey,
  type ILLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMMessage,
  type StreamChunk,
} from "./provider";
import { anthropicStreamEventSchema } from "./schemas";
import { logger } from "../utils/logger";

const SANOSHIELD_PROXY_URL = import.meta.env.VITE_SANOSHIELD_PROXY_URL ?? "http://localhost:8080";

export class AnthropicProvider implements ILLMProvider {
  public readonly id = "anthropic";

  public supports(model: string): boolean {
    return /^(claude|anthropic)/iu.test(model);
  }

  public async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const startedAt = performance.now();
    const response = await fetch(`${SANOSHIELD_PROXY_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": await requireProviderKey("anthropic"),
        "X-Oclushion-Source": "desktop-shell", // Audit traceability
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 4096,
        system: request.systemPrompt,
        messages: toAnthropicMessages(request),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as AnthropicResponse;
    if (!response.ok) {
      throw new Error(
        payload.error?.message ?? `Anthropic request failed with HTTP ${response.status}`,
      );
    }
    const content =
      payload.content
        ?.filter((item): item is { type: "text"; text: string } => item.type === "text")
        .map((item) => item.text)
        .join("\n")
        .trim() ?? "";
    if (!content) {
      throw new Error("Anthropic returned an empty response.");
    }
    return {
      provider: this.id,
      model: request.model,
      content,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }

  public async *stream(request: LLMGenerateRequest): AsyncIterable<StreamChunk> {
    const response = await fetch(`${SANOSHIELD_PROXY_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": await requireProviderKey("anthropic"),
        "X-Oclushion-Source": "desktop-shell",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: 4096,
        system: request.systemPrompt,
        messages: toAnthropicMessages(request),
        stream: true,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as AnthropicResponse;
      throw new Error(
        payload.error?.message ?? `Anthropic request failed with HTTP ${response.status}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Anthropic response body is not readable.");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const parsed = anthropicStreamEventSchema.safeParse(JSON.parse(trimmed.slice(6)));
            if (!parsed.success) continue;
            const event = parsed.data;

            if (event.type === "content_block_delta" && event.delta?.text) {
              yield { delta: event.delta.text };
            } else if (event.type === "message_stop") {
              yield { delta: "", finishReason: "stop" };
              return;
            } else if (event.type === "message_delta" && event.delta?.stop_reason === "max_tokens") {
              yield { delta: "", finishReason: "length" };
              return;
            }
          } catch (error) {
            logger.debug('AnthropicProvider', 'Skipping malformed SSE line from stream', error);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

function toAnthropicMessages(request: LLMGenerateRequest): Array<Omit<LLMMessage, "role"> & { role: "user" | "assistant" }> {
  const messages = request.messages?.length ? request.messages : [{ role: "user" as const, content: request.userMessage }];
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));
}
