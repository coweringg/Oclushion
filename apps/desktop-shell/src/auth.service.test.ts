import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageKey = "oclushion.session.v1";

class MemoryStorage {
  public readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public clear(): void {
    this.values.clear();
  }
}

const sessionPayload = {
  token: "session-token",
  user: {
    id: "usr_1",
    email: "dev@oclushion.test",
    name: "Dev User",
    plan: "Pro",
    organizationId: "org_1",
    planRenewalDate: "2026-07-05T00:00:00.000Z",
  },
};

let storage: MemoryStorage;

describe("auth service", () => {
  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("VITE_OCLUSHION_CONTROL_API_URL", "http://localhost:8082");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists sessions returned by login", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sessionPayload), { status: 200 }),
    );
    const { getStoredSession, loginWithControlApi } = await import("./auth.service");

    const session = await loginWithControlApi({
      email: "dev@oclushion.test",
      password: "correct-password",
    });

    expect(session.token).toBe("session-token");
    expect(getStoredSession()?.user.email).toBe("dev@oclushion.test");
    const stored = JSON.parse(storage.getItem(storageKey) ?? "{}");
    expect(stored.user.email).toBe("dev@oclushion.test");
    expect(stored.token).toBe("session-token");
  });

  it("clears persisted session on logout", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(sessionPayload), { status: 200 }),
    );
    const { getStoredSession, loginWithControlApi, logout } = await import("./auth.service");
    await loginWithControlApi({ email: "dev@oclushion.test", password: "correct-password" });

    expect(getStoredSession()).not.toBeNull();
    logout();

    expect(getStoredSession()).toBeNull();
    expect(storage.getItem(storageKey)).toBeNull();
  });

  it("drops corrupt persisted sessions instead of booting authenticated", async () => {
    storage.setItem(storageKey, "{broken-json");
    const { getStoredSession } = await import("./auth.service");

    expect(getStoredSession()).toBeNull();
    expect(storage.getItem(storageKey)).toBeNull();
  });
});
