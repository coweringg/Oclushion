import { logger } from "../utils/logger";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMGenerateRequest = {
  model: string;
  systemPrompt: string;
  userMessage: string;
  messages?: LLMMessage[];
};

export type LLMGenerateResponse = {
  provider: string;
  model: string;
  content: string;
  latencyMs: number;
};

export type StreamChunk = {
  delta: string;
  finishReason?: "stop" | "length" | "error";
};

export interface ILLMProvider {
  readonly id: string;
  supports(model: string): boolean;
  generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse>;
  stream(request: LLMGenerateRequest): AsyncIterable<StreamChunk>;
}

export function readClientEnv(name: string): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  };
  const value = meta.env?.[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function readLocalConfig(name: string): string | undefined {
  try {
    const value = globalThis.localStorage?.getItem(name);
    return value && value.trim().length > 0 ? value.trim() : undefined;
  } catch (error) {
    logger.debug('LLMProvider', `Failed to read local config: ${name}`, error);
    return undefined;
  }
}

export async function requireProviderKey(provider: "anthropic" | "openai"): Promise<string> {
  const apiKey = await loadApiKey(provider);
  if (!apiKey) {
    throw new Error(
      `Missing ${provider} API key. Save it in Oclushion settings under BYOK (Bring Your Own Key).`,
    );
  }
  return apiKey;
}
import { loadApiKey } from "./secure-keys.service";
