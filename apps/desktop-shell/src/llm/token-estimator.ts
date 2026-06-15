export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  "gpt-5.5": 131_072,
  "gpt-5.4-mini": 131_072,
  "claude-opus-4-8": 200_000,
  "claude-sonnet-4-6": 200_000,
};

const DEFAULT_TOKEN_LIMIT = 128_000;

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/u.test(text);
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  if (hasCjk(text)) {
    return Math.ceil(text.length * 1.5);
  }
  return Math.ceil(text.length / 4);
}

export function getModelTokenLimit(model: string): number {
  const normalized = model.toLowerCase();
  for (const [key, limit] of Object.entries(MODEL_TOKEN_LIMITS)) {
    if (normalized.includes(key)) return limit;
  }
  if (normalized.startsWith("gpt") || normalized.startsWith("o")) return 131_072;
  if (normalized.startsWith("claude")) return 200_000;
  if (normalized.startsWith("local") || normalized.startsWith("ollama")) return 128_000;
  return DEFAULT_TOKEN_LIMIT;
}

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return text;

  const ratio = maxTokens / estimated;
  const targetLength = Math.floor(text.length * ratio * 0.9);
  const truncated = text.slice(0, targetLength);

  const lastNewline = truncated.lastIndexOf("\n");
  if (lastNewline > targetLength * 0.8) {
    return truncated.slice(0, lastNewline) + "\n<!-- context truncated due to token limit -->\n";
  }

  return truncated + "\n<!-- context truncated due to token limit -->\n";
}