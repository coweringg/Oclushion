import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLMCacheService } from "./llm-cache.service";

describe("LLMCacheService", () => {
  let cache: LLMCacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new LLMCacheService(10, 5000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for a miss", () => {
    expect(cache.get("miss")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    cache.set("key1", "response");
    expect(cache.get("key1")).toBe("response");
    expect(cache.size()).toBe(1);
  });

  it("evicts expired entries", () => {
    cache.set("key1", "response", 100);
    vi.advanceTimersByTime(200);
    expect(cache.get("key1")).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it("evicts oldest entry when at capacity", () => {
    for (let i = 0; i < 10; i++) {
      cache.set(`key-${i}`, `val-${i}`);
    }

    cache.set("overflow", "should-evict");
    expect(cache.size()).toBe(10);
  });

  it("clears all entries on invalidate() with no prefix", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.invalidate();
    expect(cache.size()).toBe(0);
  });

  it("invalidates by model prefix", () => {
    cache.set("ollama_a", "1");
    cache.set("ollama_b", "2");
    cache.set("openai_c", "3");

    cache.invalidate("ollama");
    expect(cache.get("ollama_a")).toBeNull();
    expect(cache.get("ollama_b")).toBeNull();
    expect(cache.get("openai_c")).toBe("3");
  });

  it("computeKey produces stable hash for same input", () => {
    const key1 = cache.computeKey("gpt-4", "system", "hello");
    const key2 = cache.computeKey("gpt-4", "system", "hello");
    expect(key1).toBe(key2);
  });

  it("computeKey produces different hash for different input", () => {
    const key1 = cache.computeKey("gpt-4", "system", "hello");
    const key2 = cache.computeKey("gpt-4", "system", "world");
    expect(key1).not.toBe(key2);
  });
});
