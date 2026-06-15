import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorHandlerService } from "./error-handler.service";

describe("ErrorHandlerService", () => {
  let service: ErrorHandlerService;

  beforeEach(() => {
    service = new ErrorHandlerService();
  });

  describe("classify", () => {
    it("classifies network errors", () => {
      const error = new Error("Network request failed");
      const result = ErrorHandlerService.classify(error);
      expect(result.type).toBe("network");
      expect(result.retryable).toBe(true);
    });

    it("classifies auth errors", () => {
      const error = new Error("401 Unauthorized");
      const result = ErrorHandlerService.classify(error);
      expect(result.type).toBe("auth");
      expect(result.retryable).toBe(false);
    });

    it("classifies rate limit errors", () => {
      const error = new Error("429 Too Many Requests");
      const result = ErrorHandlerService.classify(error);
      expect(result.type).toBe("rate_limit");
      expect(result.retryable).toBe(true);
    });

    it("classifies server errors", () => {
      const error = new Error("500 Internal Server Error");
      const result = ErrorHandlerService.classify(error);
      expect(result.type).toBe("server");
      expect(result.retryable).toBe(true);
    });

    it("classifies validation errors", () => {
      const error = new Error("validation failed");
      const result = ErrorHandlerService.classify(error);
      expect(result.type).toBe("validation");
      expect(result.retryable).toBe(false);
    });

    it("classifies permission errors", () => {
      const error = new Error("permission denied");
      const result = ErrorHandlerService.classify(error);
      expect(result.type).toBe("permission");
      expect(result.retryable).toBe(false);
    });

    it("classifies config errors", () => {
      const error = new Error("API key not configured");
      const result = ErrorHandlerService.classify(error);
      expect(result.type).toBe("config");
      expect(result.retryable).toBe(false);
    });

    it("classifies unknown errors", () => {
      const error = new Error("Something weird happened");
      const result = ErrorHandlerService.classify(error);
      expect(result.type).toBe("unknown");
      expect(result.retryable).toBe(false);
    });
  });

  describe("resolve", () => {
    it("returns user-friendly error for auth errors", () => {
      const error = new Error("401 Unauthorized");
      const friendly = ErrorHandlerService.resolve(error);
      expect(friendly.code).toBe("ERR-AUTH-001");
      expect(friendly.type).toBe("auth");
      expect(friendly.action).not.toBeNull();
      expect(friendly.action?.label).toBe("Open Settings");
    });

    it("returns user-friendly error for network errors", () => {
      const error = new Error("Failed to fetch");
      const friendly = ErrorHandlerService.resolve(error);
      expect(friendly.code).toBe("ERR-NET-001");
      expect(friendly.action?.label).toBe("Check Network");
    });

    it("returns user-friendly error for rate limit", () => {
      const error = new Error("429 rate limit exceeded");
      const friendly = ErrorHandlerService.resolve(error);
      expect(friendly.code).toBe("ERR-RATE-001");
    });

    it("returns default error for unknown errors", () => {
      const error = new Error("Something weird happened");
      const friendly = ErrorHandlerService.resolve(error);
      expect(friendly.code).toBe("ERR-UNK-001");
    });

    it("returns user-friendly error for config errors", () => {
      const error = new Error("API key not configured for provider");
      const friendly = ErrorHandlerService.resolve(error);
      expect(friendly.code).toBe("ERR-CFG-001");
      expect(friendly.action?.label).toBe("Configure API Key");
    });

    it("returns user-friendly error for missing git", () => {
      const error = new Error("git not found");
      const friendly = ErrorHandlerService.resolve(error);
      expect(friendly.code).toBe("ERR-CFG-002");
      expect(friendly.action?.label).toBe("Install Git");
    });

    it("returns user-friendly error for god mode", () => {
      const error = new Error("Command requires God Mode");
      const friendly = ErrorHandlerService.resolve(error);
      expect(friendly.code).toBe("ERR-PERM-001");
    });
  });

  describe("handle", () => {
    it("emits error:occurred and error:resolved events", () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.handle(new Error("401 Unauthorized"));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error:occurred" }),
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error:resolved" }),
      );
    });
  });

  describe("withRetry", () => {
    it("retries transient errors", async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error("Network request failed");
        return "success";
      });

      const result = await service.withRetry(fn, { maxAttempts: 3, delay: 10 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("throws after max attempts", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Network request failed"));

      await expect(service.withRetry(fn, { maxAttempts: 2, delay: 10 })).rejects.toThrow("Network request failed");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("does not retry non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("401 Unauthorized"));

      await expect(service.withRetry(fn, { maxAttempts: 3, delay: 10 })).rejects.toThrow("401 Unauthorized");
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("getToastConfig", () => {
    it("returns correct config for auth errors", () => {
      const error = new Error("401 Unauthorized");
      const friendly = ErrorHandlerService.resolve(error);
      const config = ErrorHandlerService.getToastConfig(friendly);
      expect(config.title).toBe("Credentials Incorrect");
      expect(config.variant).toBe("error");
      expect(config.duration).toBe(8000);
      expect(config.action?.label).toBe("Open Settings");
    });

    it("returns correct config for rate limit errors", () => {
      const error = new Error("429 rate limit");
      const friendly = ErrorHandlerService.resolve(error);
      const config = ErrorHandlerService.getToastConfig(friendly);
      expect(config.title).toBe("Rate Limit Exceeded");
      expect(config.variant).toBe("warning");
    });
  });

  describe("resolve", () => {
    it("matches auth via pattern", () => {
      const friendly = ErrorHandlerService.resolve(new Error("Invalid API key"));
      expect(friendly.code).toBe("ERR-AUTH-001");
    });
  });
});
