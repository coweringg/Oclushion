import { beforeEach, describe, expect, it, vi } from "vitest";
import { isNetworkError, isRetryableHttpStatus, getNetworkErrorMessage, handleLLMError } from "./network-error-handler";
import * as translateModule from "../i18n/translate";

vi.mock("../i18n/translate", () => ({
  t: vi.fn((_key: string, params?: Record<string, string>) => {
    if (params?.provider) return `translated(${params.provider})`;
    return "translated";
  }),
}));

describe("network-error-handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isNetworkError", () => {
    const positiveCases = [
      { error: "eCONNRefused", desc: "ECONNREFUSED" },
      { error: "eCONNReset", desc: "ECONNRESET" },
      { error: "ETIMEDOUT", desc: "ETIMEDOUT" },
      { error: "ENOTFOUND", desc: "ENOTFOUND" },
      { error: "some network error", desc: "network" },
      { error: "fetch failed", desc: "fetch failed" },
      { error: "abort error", desc: "abort" },
      { error: "timeout of 5000ms", desc: "timeout" },
    ];

    for (const { error, desc } of positiveCases) {
      it(`returns true for ${desc}`, () => {
        expect(isNetworkError(new Error(error))).toBe(true);
      });
    }

    it("returns false for unrelated errors", () => {
      expect(isNetworkError(new Error("syntax error"))).toBe(false);
      expect(isNetworkError("some string")).toBe(false);
    });
  });

  describe("isRetryableHttpStatus", () => {
    it("returns true for 429, 500, 502, 503, 504", () => {
      expect(isRetryableHttpStatus(429)).toBe(true);
      expect(isRetryableHttpStatus(500)).toBe(true);
      expect(isRetryableHttpStatus(502)).toBe(true);
      expect(isRetryableHttpStatus(503)).toBe(true);
      expect(isRetryableHttpStatus(504)).toBe(true);
    });

    it("returns false for 200, 400, 401, 403, 404", () => {
      expect(isRetryableHttpStatus(200)).toBe(false);
      expect(isRetryableHttpStatus(400)).toBe(false);
      expect(isRetryableHttpStatus(401)).toBe(false);
      expect(isRetryableHttpStatus(403)).toBe(false);
      expect(isRetryableHttpStatus(404)).toBe(false);
    });
  });

  describe("getNetworkErrorMessage", () => {
    const context = { provider: "Ollama", model: "llama3", operation: "generate" as const };

    it("returns connection refused message", () => {
      const msg = getNetworkErrorMessage(new Error("ECONNREFUSED"), context);
      expect(msg).toContain("Ollama");
    });

    it("returns timeout message", () => {
      const msg = getNetworkErrorMessage(new Error("timeout"), context);
      expect(msg).toContain("Ollama");
    });

    it("returns rate limit message", () => {
      const msg = getNetworkErrorMessage(new Error("429 too many requests"), context);
      expect(msg).toContain("Ollama");
    });

    it("returns unauthorized message", () => {
      const msg = getNetworkErrorMessage(new Error("401 unauthorized"), context);
      expect(msg).toContain("Ollama");
    });

    it("returns generic message for unknown errors", () => {
      const msg = getNetworkErrorMessage(new Error("weird error"), context);
      expect(msg).toContain("Ollama");
    });
  });

  describe("handleLLMError", () => {
    it("throws an error", () => {
      const context = { provider: "Ollama", model: "llama3", operation: "generate" as const };
      expect(() => handleLLMError(new Error("timeout"), context)).toThrow();
    });
  });
});
