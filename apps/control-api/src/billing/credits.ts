import { getModelPricing } from "./pricing.config.js";

export type TokenUsageInput = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type CreditDebitCalculation = {
  totalTokens: number;
  credits: number;
};

export function calculateCreditsForTokens(input: TokenUsageInput): CreditDebitCalculation {
  const totalTokens = input.inputTokens + input.outputTokens;
  if (!Number.isInteger(input.inputTokens) || !Number.isInteger(input.outputTokens)) {
    throw new Error("Token counts must be integers.");
  }
  if (input.inputTokens < 0 || input.outputTokens < 0 || totalTokens <= 0) {
    throw new Error("Token counts must produce a positive usage amount.");
  }
  const pricing = getModelPricing(input.model);

  return {
    totalTokens,
    credits:
      pricing.creditsPerThousandTokens === 0
        ? 0
        : Math.max(1, Math.ceil((totalTokens / 1_000) * pricing.creditsPerThousandTokens)),
  };
}
