import {
  type ILLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type StreamChunk,
} from "./provider";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../utils/logger";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const STREAM_TIMEOUT_MS = 120_000;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

function toAnthropicMessages(req: LLMGenerateRequest): AnthropicMessage[] {
  const msgs: AnthropicMessage[] = [];
  if (req.messages) {
    for (const msg of req.messages) {
      if (msg.role !== "system") {
        msgs.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }
  } else {
    msgs.push({ role: "user", content: req.userMessage });
  }
  return msgs;
}

export class AnthropicProvider implements ILLMProvider {
  public readonly id = "anthropic";

  public supports(model: string): boolean {
    return /^(claude|anthropic)/iu.test(model);
  }

  public async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    try {
      const response = await invoke<LLMGenerateResponse>("llm_generate", {
        req: {
          provider: this.id,
          model: request.model,
          systemPrompt: request.systemPrompt,
          userMessage: request.userMessage,
          messages: request.messages ?? [],
          temperature: 0.2,
        }
      });
      return response;
    } catch (error) {
      logger.error('AnthropicProvider', 'Failed to generate natively', error);
      throw new Error(String(error));
    }
  }

  public async *stream(request: LLMGenerateRequest): AsyncIterable<StreamChunk> {
    const apiKey: string = await invoke("load_api_key", { provider: this.id });
    if (!apiKey) {
      throw new Error("No API key configured for Anthropic. Please add your API key in settings.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "X-Oclushion-Source": "desktop-shell-browser",
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: 4096,
          system: request.systemPrompt,
          messages: toAnthropicMessages(request),
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody = "";
        try { errorBody = await response.text(); } catch {  }
        throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
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

            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const eventType = parsed.type;

              if (eventType === "content_block_delta") {
                const delta = parsed.delta?.text;
                if (delta) {
                  yield { delta, finishReason: undefined };
                }
              } else if (eventType === "message_stop") {
                yield { delta: "", finishReason: "stop" };
                return;
              } else if (eventType === "message_delta") {
                const stopReason = parsed.delta?.stop_reason;
                if (stopReason) {
                  yield { delta: "", finishReason: stopReason === "max_tokens" ? "length" : stopReason };
                  return;
                }
              }
            } catch {
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (String(error).includes("aborted")) {
        throw new Error(`Anthropic stream timed out after ${STREAM_TIMEOUT_MS / 1000}s`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}