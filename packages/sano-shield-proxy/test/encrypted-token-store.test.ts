import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  RedisTokenMappingStore,
  type RedisMappingClient,
} from "../src/storage/token-mapping-store.js";

class FakeRedisClient implements RedisMappingClient {
  public value: string | null = null;

  async set(
    _key: string,
    value: string,
    _expirationMode: "EX",
    _seconds: number,
  ): Promise<unknown> {
    void _key;
    void _expirationMode;
    void _seconds;
    this.value = value;
    return "OK";
  }

  async getdel(_key: string): Promise<string | null> {
    void _key;
    const value = this.value;
    this.value = null;
    return value;
  }

  async del(_key: string): Promise<unknown> {
    void _key;
    this.value = null;
    return 1;
  }
}

describe("encrypted token mapping store", () => {
  it("persists only ciphertext and deletes mappings after consumption", async () => {
    const redis = new FakeRedisClient();
    const store = new RedisTokenMappingStore(redis, randomBytes(32), 60);

    await store.put("request-1", { "[PERSON_0]": "Juan Perez" });

    expect(redis.value).not.toContain("Juan Perez");
    await expect(store.take("request-1")).resolves.toEqual({ "[PERSON_0]": "Juan Perez" });
    expect(redis.value).toBeNull();
  });
});
