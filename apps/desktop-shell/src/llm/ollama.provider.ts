import { z } from "zod";
import {
  readClientEnv,
  readLocalConfig,
  type ILLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type StreamChunk,
} from "./provider";
import { logger } from "../utils/logger";
import { ollamaGenerateResponseSchema } from "./schemas";
import { withRetry } from "./retry";

type OllamaGenerateResponse = z.infer<typeof ollamaGenerateResponseSchema>;
const STREAM_TIMEOUT_MS = 120_000;
const GENERATE_TIMEOUT_MS = 60_000;

export class OllamaProvider implements ILLMProvider {
  public readonly id = "ollama";

  public supports(model: string): boolean {
    return /^(local|ollama|lmstudio)\//iu.test(model);
  }

  public async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const startedAt = performance.now();
    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);
      try {
        const model = request.model.replace(/^(local|ollama)\//iu, "");
        const response = await fetch(`${getOllamaBaseUrl()}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt: `${request.systemPrompt}\n\n<user_message>\n${request.userMessage}\n</user_message>`,
            stream: false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const parsed = ollamaGenerateResponseSchema.safeParse(await response.json().catch(() => ({})));
        const payload = parsed.success ? parsed.data : {};
        if (!response.ok) {
          throw new Error(payload.error ?? `Ollama request failed with HTTP ${response.status}`);
        }
        if (!payload.response) {
          throw new Error("Ollama returned an empty response.");
        }
        return {
          provider: this.id,
          model: request.model,
          content: payload.response,
          latencyMs: Math.round(performance.now() - startedAt),
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (String(error).includes("aborted")) {
          throw new Error(`Ollama request timed out after ${GENERATE_TIMEOUT_MS / 1000}s`);
        }
        throw error;
      }
    });
  }

  public async *stream(request: LLMGenerateRequest): AsyncIterable<StreamChunk> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const model = request.model.replace(/^(local|ollama)\//iu, "");
      const response = await fetch(`${getOllamaBaseUrl()}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: `${request.systemPrompt}\n\n<user_message>\n${request.userMessage}\n</user_message>`,
          stream: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const parsed = ollamaGenerateResponseSchema.safeParse(await response.json().catch(() => ({})));
        const payload = parsed.success ? parsed.data : {};
        throw new Error(payload.error ?? `Ollama request failed with HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Ollama response body is not readable.");
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
            if (!trimmed) continue;

            try {
              const parsed = ollamaGenerateResponseSchema.safeParse(JSON.parse(trimmed));
              if (!parsed.success) continue;
              const data = parsed.data;
              if (data.response) {
                yield {
                  delta: data.response,
                  finishReason: data.done ? "stop" : undefined,
                };
              }
            } catch (error) {
              logger.debug('OllamaProvider', 'Skipping malformed JSON line from stream', error);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (String(error).includes("aborted")) {
        throw new Error(`Ollama stream timed out after ${STREAM_TIMEOUT_MS / 1000}s`);
      }
      throw error;
    }
  }
}

function getOllamaBaseUrl(): string {
  const baseUrl = (
    readLocalConfig("oclushion.llm.ollama-base-url") ??
    readClientEnv("VITE_OLLAMA_BASE_URL") ??
    "http://localhost:11434"
  ).replace(/\/$/u, "");

  if (!baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
    logger.warn('OllamaProvider', `Using non-localhost Ollama URL: ${baseUrl}`);
  }
  if (baseUrl.startsWith("http://") && !baseUrl.includes("localhost")) {
    logger.warn('OllamaProvider', 'Using HTTP (not HTTPS) with non-localhost Ollama');
  }

  return baseUrl;
}
