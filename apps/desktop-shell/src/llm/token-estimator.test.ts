import { describe, expect, it } from "vitest";

import {
  estimateTokens,
  getModelTokenLimit,
  MODEL_TOKEN_LIMITS,
  truncateToTokenLimit,
} from "./token-estimator";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates tokens for ASCII text at ~4 chars per token", () => {
    const text = "Hello world this is a test";
    const expected = Math.ceil(text.length / 4);
    expect(estimateTokens(text)).toBe(expected);
  });

  it("estimates tokens for CJK text at ~1.5 chars per token", () => {
    const text = "你好世界，这是一个测试";
    const expected = Math.ceil(text.length * 1.5);
    expect(estimateTokens(text)).toBe(expected);
  });

  it("estimates tokens for mixed ASCII and CJK text", () => {
    const text = "Hello 你好 world 世界";
    expect(estimateTokens(text)).toBe(Math.ceil(text.length * 1.5));
  });

  it("returns at least 1 token for single character", () => {
    expect(estimateTokens("a")).toBe(1);
  });

  it("handles long text proportionally", () => {
    const text = "word ".repeat(1000);
    const expected = Math.ceil(text.length / 4);
    expect(estimateTokens(text)).toBe(expected);
  });

  it("handles long CJK text proportionally", () => {
    const text = "字".repeat(1000);
    const expected = Math.ceil(text.length * 1.5);
    expect(estimateTokens(text)).toBe(expected);
  });
});

describe("getModelTokenLimit", () => {
  it("returns 131072 for gpt-5.5", () => {
    expect(getModelTokenLimit("gpt-5.5")).toBe(131_072);
  });

  it("returns 131072 for gpt-5.4-mini", () => {
    expect(getModelTokenLimit("gpt-5.4-mini")).toBe(131_072);
  });

  it("returns 200000 for claude-opus-4-8", () => {
    expect(getModelTokenLimit("claude-opus-4-8")).toBe(200_000);
  });

  it("returns 200000 for claude-sonnet-4-6", () => {
    expect(getModelTokenLimit("claude-sonnet-4-6")).toBe(200_000);
  });

  it("is case-insensitive", () => {
    expect(getModelTokenLimit("GPT-5.5")).toBe(131_072);
    expect(getModelTokenLimit("CLAUDE-OPUS-4-8")).toBe(200_000);
  });

  it("matches known models by substring", () => {
    expect(getModelTokenLimit("prefix/gpt-5.4-mini")).toBe(131_072);
  });

  it("falls back to 131072 for unknown gpt-* models", () => {
    expect(getModelTokenLimit("gpt-6")).toBe(131_072);
  });

  it("falls back to 131072 for o-series models", () => {
    expect(getModelTokenLimit("o3-mini")).toBe(131_072);
  });

  it("falls back to 200000 for unknown claude-* models", () => {
    expect(getModelTokenLimit("claude-5")).toBe(200_000);
  });

  it("falls back to 128000 for local/ prefixed models", () => {
    expect(getModelTokenLimit("local/llama3")).toBe(128_000);
  });

  it("falls back to 131072 for ollama/ prefixed models (caught by o* prefix)", () => {
    expect(getModelTokenLimit("ollama/codellama")).toBe(131_072);
  });

  it("returns default limit for unrecognized models", () => {
    expect(getModelTokenLimit("gemini-pro")).toBe(128_000);
  });

  it("MODEL_TOKEN_LIMITS entries match getModelTokenLimit", () => {
    for (const [model, limit] of Object.entries(MODEL_TOKEN_LIMITS)) {
      expect(getModelTokenLimit(model)).toBe(limit);
    }
  });
});

describe("truncateToTokenLimit", () => {
  it("returns text unchanged when under token limit", () => {
    const text = "short";
    expect(truncateToTokenLimit(text, 1000)).toBe(text);
  });

  it("truncates text that exceeds token limit", () => {
    const text = "hello world how are you today";
    const result = truncateToTokenLimit(text, 1);
    expect(result).not.toBe(text);
    expect(estimateTokens(result.replace("<!-- context truncated due to token limit -->", ""))).toBeLessThan(estimateTokens(text));
  });

  it("appends truncation comment to truncated output", () => {
    const text = "hello world how are you today";
    const result = truncateToTokenLimit(text, 1);
    expect(result).toContain("<!-- context truncated due to token limit -->");
  });

  it("preserves content up to a reasonable portion of the limit", () => {
    const text = "word ".repeat(500);
    const limit = 50;
    const result = truncateToTokenLimit(text, limit);
    const estimated = estimateTokens(result.replace("<!-- context truncated due to token limit -->", ""));
    expect(estimated).toBeLessThanOrEqual(limit * 2);
  });

  it("truncates at a newline boundary when possible", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`);
    const text = lines.join("\n");
    const result = truncateToTokenLimit(text, 10);
    expect(result).toContain("<!-- context truncated due to token limit -->");
  });

  it("returns truncated content when limit is 0", () => {
    const text = "some text here";
    const result = truncateToTokenLimit(text, 0);
    expect(result).not.toBe(text);
    expect(result).toContain("<!-- context truncated due to token limit -->");
  });

  it("handles empty string gracefully", () => {
    expect(truncateToTokenLimit("", 100)).toBe("");
  });
});
