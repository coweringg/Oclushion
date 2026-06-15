import { logger } from "../utils/logger";
import { AnthropicProvider } from "./anthropic.provider";
import { LMStudioProvider } from "./lmstudio.provider";
import { OllamaProvider } from "./ollama.provider";
import type { ILLMProvider, LLMGenerateRequest, LLMGenerateResponse, StreamChunk } from "./provider";
import { withRetry } from "./retry";
import { estimateTokens, getModelTokenLimit, truncateToTokenLimit } from "./token-estimator";

export type ModelRouterConfig = {
  providers?: ILLMProvider[];
  fallbacks?: Record<string, string[]>;
};

const DEFAULT_FALLBACKS: Record<string, string[]> = {
  "openai": ["anthropic"],
  "anthropic": ["openai"],
  "ollama": ["openai"],
};

export class ModelRouter {
  private readonly providers: ILLMProvider[];
  private readonly fallbacks: Record<string, string[]>;

  public constructor(config: ModelRouterConfig = {}) {
    this.providers = config.providers ?? [
      new OllamaProvider(),
      new LMStudioProvider(),
      new AnthropicProvider(),
      new OpenAIProvider(),
    ];
    this.fallbacks = config.fallbacks ?? DEFAULT_FALLBACKS;
  }

  public resolveProvider(model: string): ILLMProvider {
    const provider = this.providers.find((candidate) => candidate.supports(model));
    if (!provider) {
      throw new Error(`No LLM provider configured for model: ${model}`);
    }
    return provider;
  }

  public async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const safeRequest = this.validateRequest(request);
    return this.withFallback(safeRequest, (req) =>
      withRetry(() => this.resolveProvider(req.model).generate(req), { maxAttempts: 3 }),
    );
  }

  public stream(request: LLMGenerateRequest): AsyncIterable<StreamChunk> {
    const safeRequest = this.validateRequest(request);
    const provider = this.resolveProvider(safeRequest.model);
    return provider.stream(safeRequest);
  }

  private validateRequest(request: LLMGenerateRequest): LLMGenerateRequest {
    const modelLimit = getModelTokenLimit(request.model);
    const systemTokens = estimateTokens(request.systemPrompt);
    const messageTokens = request.messages
      ? request.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
      : estimateTokens(request.userMessage);

    const totalTokens = systemTokens + messageTokens;
    const reserveTokens = Math.floor(modelLimit * 0.15);

    if (totalTokens <= modelLimit - reserveTokens) {
      return request;
    }

    logger.warn("ModelRouter", `Request tokens (${totalTokens}) exceed available limit (${modelLimit - reserveTokens}) for model ${request.model}. Truncating context.`);

    const maxContentTokens = modelLimit - reserveTokens - systemTokens;
    const safeRequest: LLMGenerateRequest = {
      ...request,
      userMessage: truncateToTokenLimit(request.userMessage, maxContentTokens),
    };
    if (safeRequest.messages) {
      safeRequest.messages = safeRequest.messages.map((msg) => ({
        ...msg,
        content: truncateToTokenLimit(msg.content, maxContentTokens),
      }));
    }
    return safeRequest;
  }

  private async withFallback(
    request: LLMGenerateRequest,
    fn: (req: LLMGenerateRequest) => Promise<LLMGenerateResponse>,
  ): Promise<LLMGenerateResponse> {
    try {
      return await fn(request);
    } catch (error) {
      const providerId = this.resolveProvider(request.model).id;
      const chain = this.fallbacks[providerId];
      if (!chain || chain.length === 0) throw error;

      for (const fallbackId of chain) {
        const fallbackProvider = this.providers.find((p) => p.id === fallbackId);
        if (!fallbackProvider) continue;

        try {
          logger.warn('ModelRouter', `Falling back from ${providerId} to ${fallbackId}`, error);
          return await fallbackProvider.generate(request);
        } catch {
          continue;
        }
      }
      throw error;
    }
  }
}
