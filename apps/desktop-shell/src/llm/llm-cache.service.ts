import { logger } from "../utils/logger";

type CacheEntry = {
  response: string;
  cachedAt: number;
  ttlMs: number;
  accessCount: number;
};

export class LLMCacheService {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private defaultTtlMs: number;

  public constructor(maxSize = 500, defaultTtlMs = 300_000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
  }

  public computeKey(model: string, systemPrompt: string, userMessage: string): string {
    const input = `${model}|${systemPrompt}|${userMessage}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `${model}_${Math.abs(hash).toString(36)}`;
  }

  public get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    this.updateLru(key);
    return entry.response;
  }

  public set(key: string, response: string, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    this.cache.set(key, {
      response,
      cachedAt: Date.now(),
      ttlMs: ttlMs ?? this.defaultTtlMs,
      accessCount: 0,
    });
  }

  public invalidate(modelPrefix?: string): void {
    if (!modelPrefix) {
      this.cache.clear();
      logger.info("LLMCache", "Cache cleared");
      return;
    }
    for (const [key] of this.cache) {
      if (key.startsWith(modelPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  public size(): number {
    return this.cache.size;
  }

  private evict(): void {
    let lruKey: string | null = null;
    let lruAccess = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessCount < lruAccess) {
        lruAccess = entry.accessCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  private updateLru(_key: string): void {
  }
}