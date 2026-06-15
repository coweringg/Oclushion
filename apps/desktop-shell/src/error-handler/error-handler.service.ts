import type { ErrorCode, ErrorType, UserFriendlyError, ErrorAction } from "./error-catalog";
import { buildUserFriendlyError, matchError } from "./error-catalog";

export type { ErrorCode, ErrorType, UserFriendlyError, ErrorAction };

export type AppError = {
  type: ErrorType;
  message: string;
  originalError: Error;
  retryable: boolean;
  retryAfter?: number;
};

export type ErrorHandlerEvent =
  | { type: "error:occurred"; error: AppError }
  | { type: "error:resolved"; error: UserFriendlyError }
  | { type: "error:retrying"; error: AppError; attempt: number }
  | { type: "error:retried"; error: AppError }
  | { type: "error:failed"; error: UserFriendlyError; finalError: Error };

export type ErrorHandlerListener = (event: ErrorHandlerEvent) => void;

export class ErrorHandlerService {
  private listeners = new Set<ErrorHandlerListener>();

  static classify(error: Error): AppError {
    const m = error.message.toLowerCase();

    if (m.includes("god mode") || m.includes("command not allowed") || m.includes("execution denied")) {
      return { type: "permission", message: error.message, originalError: error, retryable: false };
    }
    if (m.includes("api key not configured") || m.includes("missing api key") || m.includes("provider not configured") || m.includes("git not found")) {
      return { type: "config", message: error.message, originalError: error, retryable: false };
    }
    if (m.includes("429") || m.includes("rate limit") || m.includes("quota exceeded") || m.includes("too many requests")) {
      return { type: "rate_limit", message: error.message, originalError: error, retryable: true };
    }
    if (m.includes("401") || m.includes("unauthorized") || m.includes("403") || m.includes("forbidden") || m.includes("invalid api key")) {
      return { type: "auth", message: error.message, originalError: error, retryable: false };
    }
    if (m.includes("fetch") || m.includes("network") || m.includes("timeout") || m.includes("econnrefused") || m.includes("enotfound") || m.includes("socket hang up")) {
      return { type: "network", message: error.message, originalError: error, retryable: true };
    }
    if (m.includes("500") || m.includes("502") || m.includes("503") || m.includes("504")) {
      return { type: "server", message: error.message, originalError: error, retryable: true };
    }
    if (m.includes("validation") || m.includes("invalid input") || m.includes("bad request") || m.includes("400")) {
      return { type: "validation", message: error.message, originalError: error, retryable: false };
    }
    if (m.includes("permission") || m.includes("denied") || m.includes("not allowed")) {
      return { type: "permission", message: error.message, originalError: error, retryable: false };
    }
    if (m.includes("not configured") || m.includes("workspace not found")) {
      return { type: "config", message: error.message, originalError: error, retryable: false };
    }

    return { type: "unknown", message: error.message, originalError: error, retryable: false };
  }

  static resolve(error: Error): UserFriendlyError {
    return buildUserFriendlyError(error);
  }

  handle(error: Error): UserFriendlyError {
    const appError = ErrorHandlerService.classify(error);
    this.emit({ type: "error:occurred", error: appError });

    const friendly = buildUserFriendlyError(error);
    this.emit({ type: "error:resolved", error: friendly });

    return friendly;
  }

  async withRetry<T>(
    fn: () => Promise<T>,
    options: { maxAttempts?: number; delay?: number } = {},
  ): Promise<T> {
    const { maxAttempts = 3, delay = 1000 } = options;
    if (maxAttempts < 1) throw new Error("maxAttempts must be >= 1");
    if (delay < 0) throw new Error("delay must be >= 0");
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const appError = ErrorHandlerService.classify(lastError);

        if (!appError.retryable || attempt === maxAttempts) {
          const friendly = buildUserFriendlyError(lastError);
          this.emit({ type: "error:failed", error: friendly, finalError: lastError });
          throw lastError;
        }

        this.emit({ type: "error:retrying", error: appError, attempt });
        await this.sleep(delay * attempt);
      }
    }

    throw lastError;
  }

  static getToastConfig(error: UserFriendlyError): {
    title: string;
    message: string;
    variant: "error" | "warning";
    duration: number;
    action: ErrorAction | null;
  } {
    const durations: Record<string, number> = {
      network: 5000,
      auth: 8000,
      rate_limit: 10000,
      server: 5000,
      validation: 4000,
      permission: 6000,
      config: 6000,
      unknown: 4000,
    };

    return {
      title: error.title,
      message: error.explanation,
      variant: error.type === "rate_limit" ? "warning" : "error",
      duration: durations[error.type] ?? 4000,
      action: error.action,
    };
  }

  subscribe(listener: ErrorHandlerListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  destroy(): void {
    this.listeners.clear();
  }

  private emit(event: ErrorHandlerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export { matchError, buildUserFriendlyError } from "./error-catalog";
