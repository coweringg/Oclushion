import { describe, expect, it } from "vitest";

import { SecureKeysService, type SecureKeyStore } from "./secure-keys.service";

class MemoryStore implements SecureKeyStore {
  public readonly isSecure = false;

  public readonly values = new Map<string, unknown>();
  public saves = 0;

  public async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  public async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  public async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  public async save(): Promise<void> {
    this.saves += 1;
  }
}

describe("SecureKeysService", () => {
  it("stores BYOK provider keys behind the secure store boundary", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    await service.saveApiKey("openai", " sk-live-test ");
    await expect(service.loadApiKey("openai")).resolves.toBe("sk-live-test");
    expect(store.values.get("apikey.openai")).toBe("sk-live-test");
    expect(store.saves).toBe(1);

    await service.saveApiKey("openai", "");
    await expect(service.loadApiKey("openai")).resolves.toBeNull();
    expect(store.values.has("apikey.openai")).toBe(false);
  });

  it("stores session tokens under session.auth", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    await service.saveKey("session", "auth", "jwt-token-123");
    await expect(service.loadKey("session", "auth")).resolves.toBe("jwt-token-123");
    expect(store.values.get("session.auth")).toBe("jwt-token-123");

    await service.deleteKey("session", "auth");
    await expect(service.loadKey("session", "auth")).resolves.toBeNull();
  });

  it("stores license keys under license.active", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    await service.saveKey("license", "active", "lic_abc123");
    await expect(service.loadKey("license", "active")).resolves.toBe("lic_abc123");
    expect(store.values.get("license.active")).toBe("lic_abc123");
  });

  it("stores encryption keys under encryption.sqlite", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    await service.saveKey("encryption", "sqlite", "deadbeef");
    await expect(service.loadKey("encryption", "sqlite")).resolves.toBe("deadbeef");
    expect(store.values.get("encryption.sqlite")).toBe("deadbeef");
  });

  it("different key types do not collide", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    await service.saveKey("apikey", "openai", "openai-key");
    await service.saveKey("session", "auth", "session-token");
    await service.saveKey("license", "active", "license-key");

    await expect(service.loadKey("apikey", "openai")).resolves.toBe("openai-key");
    await expect(service.loadKey("session", "auth")).resolves.toBe("session-token");
    await expect(service.loadKey("license", "active")).resolves.toBe("license-key");
  });

  it("trims whitespace from values", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    await service.saveKey("license", "active", "  lic-spaces  ");
    await expect(service.loadKey("license", "active")).resolves.toBe("lic-spaces");
  });

  it("returns null for empty string values", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    await service.saveKey("license", "active", "");
    await expect(service.loadKey("license", "active")).resolves.toBeNull();
    expect(store.values.has("license.active")).toBe(false);
  });

  it("loadAll returns all provider keys", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    await service.saveApiKey("openai", "openai-key-123");
    await service.saveApiKey("anthropic", "anthropic-key-456");

    const result = await service.loadAll();
    expect(result).toEqual({ openai: "openai-key-123", anthropic: "anthropic-key-456" });
  });

  it("loadAll returns empty strings for missing keys", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    const result = await service.loadAll();
    expect(result).toEqual({ openai: "", anthropic: "" });
  });

  it("getOrCreateKey returns existing key without regenerating", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    await service.saveKey("session", "token", "existing-token");
    const result = await service.getOrCreateKey("session", "token", 16);

    expect(result).toBe("existing-token");
    expect(store.values.get("session.token")).toBe("existing-token");
  });

  it("getOrCreateKey generates a new key when none exists", async () => {
    const store = new MemoryStore();
    const service = new SecureKeysService(async () => store);

    const result = await service.getOrCreateKey("encryption", "db", 32);

    expect(typeof result).toBe("string");
    expect(result.length).toBe(64); // 32 bytes = 64 hex chars
    expect(store.values.get("encryption.db")).toBe(result);
  });
});
