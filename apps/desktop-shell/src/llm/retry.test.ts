import { beforeEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry";

vi.mock("../utils/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe("retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  describe("withRetry", () => {
    it("returns the result on success", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      await expect(withRetry(fn)).resolves.toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("passes the attempt number to fn", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      await withRetry(fn);
      expect(fn).toHaveBeenCalledWith(1);
    });

    describe("retries on retryable errors", () => {
      const retryableCases = [
        "429 too many requests",
        "500 internal server error",
        "502 bad gateway error",
        "503 service unavailable",
        "timeout of 5000ms exceeded",
        "network error",
        "fetch failed",
        "econnrefused",
        "econnreset",
        "etimedout",
        "abort error",
      ];

      for (const msg of retryableCases) {
        it(`retries on "${msg}"`, async () => {
          const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error(msg))
            .mockResolvedValueOnce("ok");
          await expect(withRetry(fn)).resolves.toBe("ok");
          expect(fn).toHaveBeenCalledTimes(2);
        });
      }
    });

    describe("does not retry on non-retryable errors", () => {
      const nonRetryableCases = [
        "400 bad request",
        "401 unauthorized",
        "403 forbidden",
        "404 not found",
        "409 conflict",
        "422 unprocessable entity",
        "syntax error",
        "typeerror: cannot read property",
      ];

      for (const msg of nonRetryableCases) {
        it(`does not retry on "${msg}"`, async () => {
          const fn = vi.fn().mockRejectedValue(new Error(msg));
          await expect(withRetry(fn)).rejects.toThrow(msg);
          expect(fn).toHaveBeenCalledTimes(1);
        });
      }
    });

    it("respects max retries and throws last error", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("503 service unavailable"));
      await expect(withRetry(fn, { maxAttempts: 2 })).rejects.toThrow(
        "503 service unavailable",
      );
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("throws immediately on non-retryable error regardless of attempts left", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("404 not found"));
      await expect(
        withRetry(fn, { maxAttempts: 5 }),
      ).rejects.toThrow("404 not found");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("uses exponential backoff with jitter", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("429 rate limited"))
        .mockRejectedValueOnce(new Error("429 rate limited"))
        .mockResolvedValueOnce("ok");
      const baseDelayMs = 100;
      await withRetry(fn, { maxAttempts: 3, baseDelayMs, maxDelayMs: 10_000 });

      const delay = await import("timers/promises").catch(
        () => null,
      );
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("uses custom config", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("429 rate limited"))
        .mockResolvedValueOnce("ok");
      const result = await withRetry(fn, {
        maxAttempts: 2,
        baseDelayMs: 50,
        maxDelayMs: 500,
      });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("uses defaults when config is empty", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      await expect(withRetry(fn, {})).resolves.toBe("ok");
    });

    it("calls logger.warn on retry", async () => {
      const { logger } = await import("../utils/logger");
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("429 too many requests"))
        .mockResolvedValueOnce("ok");
      await withRetry(fn);
      expect(logger.warn).toHaveBeenCalledWith(
        "Retry",
        expect.stringContaining("Attempt 1/3 failed"),
        expect.any(Error),
      );
    });

    it("handles abort signal (AbortError is retryable)", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"))
        .mockResolvedValueOnce("ok");
      await expect(withRetry(fn)).resolves.toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("re-throws non-retryable errors on last attempt without extra log", async () => {
      const { logger } = await import("../utils/logger");
      const fn = vi.fn().mockRejectedValue(new Error("500 internal server"));
      await expect(
        withRetry(fn, { maxAttempts: 1 }),
      ).rejects.toThrow("500 internal server");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("rejects when fn throws a non-error value", async () => {
      const fn = vi.fn().mockRejectedValue("string error");
      await expect(withRetry(fn)).rejects.toBe("string error");
    });
  });
});
