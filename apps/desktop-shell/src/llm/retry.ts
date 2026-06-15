import { logger } from "../utils/logger";

export type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
};

function isRetryable(error: unknown): boolean {
  const message = String(error).toLowerCase();
  if (message.includes("429") || message.includes("too many requests")) return true;
  if (message.includes("503") || message.includes("service unavailable")) return true;
  if (message.includes("502") || message.includes("bad gateway")) return true;
  if (message.includes("500") || message.includes("internal server")) return true;
  if (message.includes("abort") || message.includes("timeout")) return true;
  if (message.includes("econnrefused") || message.includes("econnreset")) return true;
  if (message.includes("etimedout") || message.includes("eaddrinfo")) return true;
  if (message.includes("network") || message.includes("fetch failed")) return true;
  return false;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = { ...DEFAULT_RETRY, ...config };
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts && isRetryable(error)) {
        const jitter = Math.random() * 500;
        const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1) + jitter, maxDelayMs);
        logger.warn("Retry", `Attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(backoff)}ms`, error);
        await delay(backoff);
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}