import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { LocalStorageSessionStore } from "./session-store";

describe("LocalStorageSessionStore", () => {
  let store: LocalStorageSessionStore;

  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
      clear: () => storage.clear(),
      get length() { return storage.size; },
      key: (index: number) => [...storage.keys()][index] ?? null,
    });
    store = new LocalStorageSessionStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when no session exists", async () => {
    expect(await store.getSession()).toBeNull();
  });

  it("persists and retrieves session data", async () => {
    const data = { token: "test-token", user: { id: "1", email: "test@test.com" } };
    await store.setSession(data);
    const retrieved = await store.getSession();
    expect(retrieved).toEqual(data);
  });

  it("clears session data", async () => {
    const data = { token: "test-token", user: { id: "1", email: "test@test.com" } };
    await store.setSession(data);
    await store.clearSession();
    expect(await store.getSession()).toBeNull();
  });

  it("reports isSecure as false", () => {
    expect(store.isSecure).toBe(false);
  });
});