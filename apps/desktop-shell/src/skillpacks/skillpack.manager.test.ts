import { describe, expect, it } from "vitest";

import { sha256Hex } from "../marketplace/integrity";
import { MemoryKeyValueStore } from "../persistent-store";
import type { MarketplaceSkillpack } from "../types/skillpack";
import { SkillpackManager } from "./skillpack.manager";

function skillpackHash(sp: Partial<MarketplaceSkillpack>): string {
  return "not-a-valid-hash";
}

const catalogWithoutHash: MarketplaceSkillpack[] = [
  {
    id: "nextjs-app-router-guru",
    name: "Next.js App Router Guru",
    version: "1.0.0",
    role: "nextjs-app-router",
    planTier: "Pro",
    description: "Next.js expert.",
    systemRules: ["Use Server Components by default."],
    forbiddenPatterns: ["Client secrets"],
    requiredPractices: ["Validate build"],
    outputFormat: {
      style: "implementation-first",
      sections: ["implementation"],
      requiresTestsSummary: true,
    },
    contextDirectives: ["Read app routes first."],
    author: "Oclushion",
    category: "official",
    installState: "available",
  },
];

async function makeCatalogWithHash(): Promise<MarketplaceSkillpack[]> {
  const sp = catalogWithoutHash[0]!;
  const payload = JSON.stringify({
    id: sp.id,
    name: sp.name,
    version: sp.version,
    role: sp.role,
    description: sp.description,
    systemRules: sp.systemRules,
    forbiddenPatterns: sp.forbiddenPatterns,
    requiredPractices: sp.requiredPractices,
    outputFormat: sp.outputFormat,
    contextDirectives: sp.contextDirectives,
  });
  const hash = await sha256Hex(payload);
  return [{ ...sp, sha256: hash }];
}

function makeFetcher(catalog: MarketplaceSkillpack[]): typeof fetch {
  return async () =>
    new Response(JSON.stringify({ skillpacks: catalog }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

describe("SkillpackManager marketplace persistence", () => {
  it("installs marketplace skillpacks and serializes manifests to storage", async () => {
    const catalog = await makeCatalogWithHash();
    const storage = new MemoryKeyValueStore();
    const manager = await SkillpackManager.create({ storage, fetcher: makeFetcher(catalog) });

    await manager.install("nextjs-app-router-guru");

    expect(manager.listInstalled().map(({ skillpack }) => skillpack.id)).toContain(
      "nextjs-app-router-guru",
    );
    expect(await storage.getItem("oclushion.desktop.skillpacks.v2")).toContain(
      "nextjs-app-router-guru",
    );

    const rehydrated = await SkillpackManager.create({ storage, fetcher: makeFetcher(catalog) });
    expect(rehydrated.listInstalled().map(({ skillpack }) => skillpack.id)).toContain(
      "nextjs-app-router-guru",
    );
    expect(
      (await rehydrated.fetchMarketplace()).find(
        (skillpack) => skillpack.id === "nextjs-app-router-guru",
      ),
    ).toMatchObject({
      installState: "installed",
    });
  });

  it("uninstalls marketplace skillpacks and keeps bundled defaults", async () => {
    const catalog = await makeCatalogWithHash();
    const storage = new MemoryKeyValueStore();
    const manager = await SkillpackManager.create({ storage, fetcher: makeFetcher(catalog) });

    await manager.install("nextjs-app-router-guru");
    await manager.uninstall("nextjs-app-router-guru");

    const installedIds = manager.listInstalled().map(({ skillpack }) => skillpack.id);
    expect(installedIds).not.toContain("nextjs-app-router-guru");
    expect(installedIds).toContain("senior-fullstack-node");
  });

  it("falls back to bundled defaults when persisted JSON is invalid", async () => {
    const storage = new MemoryKeyValueStore();
    await storage.setItem("oclushion.desktop.skillpacks.v2", "{nope");

    const catalog = await makeCatalogWithHash();
    const manager = await SkillpackManager.create({ storage, fetcher: makeFetcher(catalog) });

    expect(manager.listInstalled().map(({ skillpack }) => skillpack.id)).toEqual([
      "senior-fullstack-node",
      "security-auditor-cso",
    ]);
    expect(await storage.getItem("oclushion.desktop.skillpacks.v2")).toBeNull();
  });

  it("rejects skillpacks without sha256 hash", async () => {
    const storage = new MemoryKeyValueStore();
    const manager = await SkillpackManager.create({
      storage,
      fetcher: makeFetcher(catalogWithoutHash),
    });

    const marketplace = await manager.fetchMarketplace();
    expect(marketplace).toHaveLength(0);
  });

  it("rejects skillpacks with invalid sha256 hash", async () => {
    const catalog = [{ ...catalogWithoutHash[0]!, sha256: "deadbeef00000000000000000000000000000000000000000000000000000000" }];
    const storage = new MemoryKeyValueStore();
    const manager = await SkillpackManager.create({ storage, fetcher: makeFetcher(catalog) });

    const marketplace = await manager.fetchMarketplace();
    expect(marketplace).toHaveLength(0);
  });

  it("accepts skillpacks with valid sha256 hash", async () => {
    const catalog = await makeCatalogWithHash();
    const storage = new MemoryKeyValueStore();
    const manager = await SkillpackManager.create({ storage, fetcher: makeFetcher(catalog) });

    const marketplace = await manager.fetchMarketplace();
    expect(marketplace).toHaveLength(1);
    expect(marketplace[0]!.id).toBe("nextjs-app-router-guru");
  });

  it("removes compromised persisted skillpacks on reload", async () => {
    const catalog = await makeCatalogWithHash();
    const storage = new MemoryKeyValueStore();
    const manager = await SkillpackManager.create({ storage, fetcher: makeFetcher(catalog) });

    await manager.install("nextjs-app-router-guru");

    const raw = await storage.getItem("oclushion.desktop.skillpacks.v2");
    expect(raw).toBeTruthy();

    const state = JSON.parse(raw!);
    state.marketplaceSkillpacks[0].sha256 = "0000000000000000000000000000000000000000000000000000000000000000";
    await storage.setItem("oclushion.desktop.skillpacks.v2", JSON.stringify(state));

    const rehydrated = await SkillpackManager.create({ storage, fetcher: makeFetcher(catalog) });
    const installedIds = rehydrated.listInstalled().map(({ skillpack }) => skillpack.id);
    expect(installedIds).not.toContain("nextjs-app-router-guru");
  });
});
