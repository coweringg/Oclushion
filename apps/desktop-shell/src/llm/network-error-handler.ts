import { logger } from "../utils/logger";
import { notifyError } from "../error-handler/error-notifier";
import { t } from "../i18n/translate";

export type NetworkErrorContext = {
  provider: string;
  model: string;
  operation: "generate" | "stream";
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export function isNetworkError(error: unknown): boolean {
  const message = String(error).toLowerCase();
  return (
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("enotfound") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("abort") ||
    message.includes("timeout")
  );
}

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

export function getNetworkErrorMessage(error: unknown, context: NetworkErrorContext): string {
  const message = String(error).toLowerCase();

  if (message.includes("econnrefused") || message.includes("enotfound")) {
    return `${context.provider}: ${t("errors.connectionRefused", { provider: context.provider })}`;
  }
  if (message.includes("timeout") || message.includes("abort")) {
    return `${context.provider}: ${t("errors.requestTimeout", { provider: context.provider })}`;
  }
  if (message.includes("429") || message.includes("too many requests")) {
    return `${context.provider}: ${t("errors.rateLimited", { provider: context.provider })}`;
  }
  if (message.includes("401") || message.includes("unauthorized")) {
    return `${context.provider}: ${t("errors.invalidApiKey", { provider: context.provider })}`;
  }

  return `${context.provider}: ${t("errors.unknownError", { message: String(error) })}`;
}

export function handleLLMError(error: unknown, context: NetworkErrorContext): never {
  const errorMessage = getNetworkErrorMessage(error, context);
  logger.error("LLMError", `[${context.operation}] ${errorMessage}`, error);
  notifyError(t("common.error"), errorMessage, "error");
  throw new Error(errorMessage);
}