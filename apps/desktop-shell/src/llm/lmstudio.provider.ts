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
import { withRetry } from "./retry";

const chatCompletionSchema = z.object({
  id: z.string(),
  choices: z.array(
    z.object({
      delta: z.object({ content: z.string().optional() }).optional(),
      message: z.object({ content: z.string().optional() }).optional(),
      finish_reason: z.string().nullable().optional(),
    }),
  ),
});

const STREAM_TIMEOUT_MS = 120_000;
const GENERATE_TIMEOUT_MS = 60_000;

export class LMStudioProvider implements ILLMProvider {
  public readonly id = "lmstudio";

  public supports(model: string): boolean {
    return /^lmstudio\//iu.test(model);
  }

  public async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const startedAt = performance.now();
    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);
      try {
        const model = request.model.replace(/^lmstudio\//iu, "");
        const response = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model || "default",
            messages: [
              { role: "system", content: request.systemPrompt ?? "" },
              { role: "user", content: request.userMessage },
            ],
            stream: false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`LM Studio request failed with HTTP ${response.status}`);
        }
        const parsed = chatCompletionSchema.safeParse(await response.json());
        const content = parsed.success ? (parsed.data.choices[0]?.message?.content ?? "") : "";
        return {
          provider: this.id,
          model: request.model,
          content,
          latencyMs: Math.round(performance.now() - startedAt),
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (String(error).includes("aborted")) {
          throw new Error(`LM Studio request timed out after ${GENERATE_TIMEOUT_MS / 1000}s`);
        }
        throw error;
      }
    });
  }

  public async *stream(request: LLMGenerateRequest): AsyncIterable<StreamChunk> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
    try {
      const model = request.model.replace(/^lmstudio\//iu, "");
      const response = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model || "default",
          messages: [
            { role: "system", content: request.systemPrompt ?? "" },
            { role: "user", content: request.userMessage },
          ],
          stream: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`LM Studio stream failed with HTTP ${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("LM Studio response body is not readable.");
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
            const json = trimmed.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const parsed = chatCompletionSchema.safeParse(JSON.parse(json));
              if (!parsed.success) continue;
              const choice = parsed.data.choices[0];
              if (choice?.delta?.content) {
                yield { delta: choice.delta.content, finishReason: choice.finish_reason ?? undefined };
              }
              if (choice?.finish_reason === "stop") break;
            } catch {  }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (String(error).includes("aborted")) {
        throw new Error(`LM Studio stream timed out after ${STREAM_TIMEOUT_MS / 1000}s`);
      }
      throw error;
    }
  }
}

function getBaseUrl(): string {
  return (
    readLocalConfig("oclushion.llm.lmstudio-base-url") ??
    readClientEnv("VITE_LMSTUDIO_BASE_URL") ??
    "http://localhost:1234"
  ).replace(/\/$/u, "");
}
