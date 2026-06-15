import {
  type ILLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type StreamChunk,
} from "./provider";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../utils/logger";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const STREAM_TIMEOUT_MS = 120_000;

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function toOpenAIMessages(req: LLMGenerateRequest): OpenAIMessage[] {
  const msgs: OpenAIMessage[] = [{ role: "system", content: req.systemPrompt }];
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

export class OpenAIProvider implements ILLMProvider {
  public readonly id = "openai";

  public supports(model: string): boolean {
    return /^(gpt|o[134]|chatgpt)/iu.test(model);
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
      logger.error('OpenAIProvider', 'Failed to generate natively', error);
      throw new Error(String(error));
    }
  }

  public async *stream(request: LLMGenerateRequest): AsyncIterable<StreamChunk> {
    const apiKey: string = await invoke("load_api_key", { provider: this.id });
    if (!apiKey) {
      throw new Error("No API key configured for OpenAI. Please add your API key in settings.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-Oclushion-Source": "desktop-shell-browser",
        },
        body: JSON.stringify({
          model: request.model,
          messages: toOpenAIMessages(request),
          temperature: 0.2,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody = "";
        try { errorBody = await response.text(); } catch {  }
        throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("OpenAI response body is not readable.");
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
              const choice = parsed.choices?.[0];
              if (!choice) continue;

              const delta = choice.delta?.content;
              const finishReason = choice.finish_reason;

              if (delta) {
                yield { delta, finishReason: finishReason ?? undefined };
              } else if (finishReason) {
                yield { delta: "", finishReason };
                return;
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
        throw new Error(`OpenAI stream timed out after ${STREAM_TIMEOUT_MS / 1000}s`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}