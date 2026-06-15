import { afterEach, describe, expect, it, vi } from "vitest";

import { EntitlementsService } from "./entitlements.service";
import { PlanRestrictionError } from "./entitlements.types";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

class MemorySecureKeys {
  public readonly values = new Map<string, string>();

  public async saveKey(_type: string, id: string, value: string): Promise<void> {
    this.values.set(id, value.trim());
  }

  public async loadKey(_type: string, id: string): Promise<string | null> {
    return this.values.get(id) ?? null;
  }

  public async deleteKey(_type: string, id: string): Promise<void> {
    this.values.delete(id);
  }
}

describe("EntitlementsService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks paid features for free users with controlled errors", () => {
    const service = new EntitlementsService(new MemoryStorage(), new MemorySecureKeys() as never);

    expect(service.checkAccess("hasVoiceDictation")).toBe(false);
    expect(() => service.assertAccess("hasGodMode", "God Mode")).toThrow(PlanRestrictionError);
  });

  it("grants voice and god mode to pro sessions", () => {
    const service = new EntitlementsService(new MemoryStorage(), new MemorySecureKeys() as never);

    service.updateFromSession({
      token: "token",
      user: {
        id: "user_1",
        email: "dev@oclushion.test",
        name: "Dev",
        plan: "Pro",
        organizationId: "org_1",
        planRenewalDate: "2026-12-31T00:00:00.000Z",
      },
    });

    expect(service.getCurrent().tier).toBe("pro");
    expect(service.checkAccess("hasVoiceDictation")).toBe(true);
    expect(service.checkAccess("hasGodMode")).toBe(true);
    expect(service.checkAccess("hasShipperAgent")).toBe(false);
  });

  it("maps team and enterprise plans to enterprise entitlements", () => {
    const service = new EntitlementsService(new MemoryStorage(), new MemorySecureKeys() as never);

    service.updateFromSession({
      token: "token",
      user: {
        id: "user_2",
        email: "team@oclushion.test",
        name: "Team",
        plan: "Team",
        organizationId: "org_2",
        planRenewalDate: "2026-12-31T00:00:00.000Z",
      },
    });

    expect(service.getCurrent().tier).toBe("enterprise");
    expect(service.checkAccess("hasMultiplayer")).toBe(true);
    expect(service.checkAccess("hasShipperAgent")).toBe(true);
  });

  it("syncSubscription stores license in SecureKeys, not localStorage", async () => {
    const storage = new MemoryStorage();
    const secureKeys = new MemorySecureKeys();
    const service = new EntitlementsService(storage, secureKeys as never);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ tier: "pro", userId: "u1", features: {} }), { status: 200 }),
    ));

    await service.syncSubscription("lic_test123");

    expect(secureKeys.values.get("active")).toBe("lic_test123");
    expect(storage.getItem("oclushion.entitlements.license")).toBeNull();
  });

  it("loadSavedLicense prefers SecureKeys over localStorage", async () => {
    const storage = new MemoryStorage();
    storage.setItem("oclushion.entitlements.license", "legacy-key");
    const secureKeys = new MemorySecureKeys();
    const body = JSON.stringify({ sub: "u1", plan: "pro" });
    const secureToken = `header.${btoa(body)}.sig`;
    secureKeys.values.set("active", secureToken);

    const service = new EntitlementsService(storage, secureKeys as never);
    const result = await service.loadSavedLicense();

    expect(result.tier).toBe("pro");
    expect(secureKeys.values.get("active")).toBe(secureToken);
  });

  it("migrates legacy localStorage key to SecureKeys", async () => {
    const storage = new MemoryStorage();
    const body = JSON.stringify({ sub: "u1", plan: "pro" });
    const token = `header.${btoa(body)}.sig`;
    storage.setItem("oclushion.entitlements.license", token);

    const secureKeys = new MemorySecureKeys();
    const service = new EntitlementsService(storage, secureKeys as never);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ tier: "pro", userId: "u1", features: {} }), { status: 200 }),
    ));

    await service.loadSavedLicense();

    expect(secureKeys.values.get("active")).toBe(token);
    expect(storage.getItem("oclushion.entitlements.license")).toBeNull();
  });

  it("validateAccess returns false when local check fails", async () => {
    const service = new EntitlementsService(new MemoryStorage(), new MemorySecureKeys() as never);
    expect(await service.validateAccess("hasGodMode")).toBe(false);
  });

  it("validateAccess returns false when server returns 503", async () => {
    const service = new EntitlementsService(new MemoryStorage(), new MemorySecureKeys() as never);

    service.updateFromSession({
      token: "token",
      user: {
        id: "user_1",
        email: "dev@oclushion.test",
        name: "Dev",
        plan: "Pro",
        organizationId: "org_1",
        planRenewalDate: "2026-12-31T00:00:00.000Z",
      },
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 503 }),
    ));

    expect(await service.validateAccess("hasGodMode")).toBe(false);
  });

  it("validateAccess returns true when server confirms", async () => {
    const service = new EntitlementsService(new MemoryStorage(), new MemorySecureKeys() as never);

    service.updateFromSession({
      token: "token",
      user: {
        id: "user_1",
        email: "dev@oclushion.test",
        name: "Dev",
        plan: "Pro",
        organizationId: "org_1",
        planRenewalDate: "2026-12-31T00:00:00.000Z",
      },
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ allowed: true }), { status: 200 }),
    ));

    expect(await service.validateAccess("hasGodMode")).toBe(true);
  });
});
