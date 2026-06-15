export type ModelPricing = {
  provider: "anthropic" | "openai" | "ollama" | "unknown";
  modelPattern: RegExp;
  creditsPerThousandTokens: number;
};

export const MODEL_PRICING_TABLE: ModelPricing[] = [
  { provider: "anthropic", modelPattern: /^claude-opus/iu, creditsPerThousandTokens: 30 },
  { provider: "anthropic", modelPattern: /^claude-sonnet/iu, creditsPerThousandTokens: 12 },
  { provider: "anthropic", modelPattern: /^claude-haiku/iu, creditsPerThousandTokens: 3 },
  { provider: "openai", modelPattern: /^gpt-5/iu, creditsPerThousandTokens: 18 },
  { provider: "openai", modelPattern: /^gpt-4o-mini/iu, creditsPerThousandTokens: 1 },
  { provider: "openai", modelPattern: /^gpt-4o/iu, creditsPerThousandTokens: 6 },
  { provider: "openai", modelPattern: /^gpt-4\.1/iu, creditsPerThousandTokens: 8 },
  { provider: "openai", modelPattern: /^o[134]/iu, creditsPerThousandTokens: 10 },
  { provider: "ollama", modelPattern: /^(local|ollama)\//iu, creditsPerThousandTokens: 0 },
];

export const DEFAULT_MODEL_PRICING: ModelPricing = {
  provider: "unknown",
  modelPattern: /.*/u,
  creditsPerThousandTokens: 5,
};

export const CREDIT_PACKAGES = {
  credits_20k: {
    id: "credits_20k",
    credits: 20_000,
    amountCents: 2_000,
    currency: "usd",
    label: "20,000 Oclushion Credits",
  },
  credits_100k: {
    id: "credits_100k",
    credits: 100_000,
    amountCents: 9_000,
    currency: "usd",
    label: "100,000 Oclushion Credits",
  },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;

export function getModelPricing(model: string): ModelPricing {
  return (
    MODEL_PRICING_TABLE.find((entry) => entry.modelPattern.test(model)) ?? DEFAULT_MODEL_PRICING
  );
}
