import { describe, expect, it } from "vitest";

import { MemoryKeyValueStore } from "../persistent-store";
import { sha256Hex } from "./integrity";
import type { MarketplaceCatalog, Skill } from "./marketplace.types";
import { MemoryMarketplaceFileSystem } from "./marketplace.storage";
import { MarketplaceRegistry } from "./registry";
import { MarketplaceService } from "./marketplace.service";
import { SkillsInstaller } from "./skills.installer";
import { ToolsInstaller } from "./tools.installer";

describe("MarketplaceService", () => {
  it("fails onboarding closed when the marketplace catalog has not loaded", async () => {
    const service = new MarketplaceService(new MemoryKeyValueStore());

    await expect(service.installProfile("fullstack")).rejects.toMatchObject({
      name: "MarketplaceError",
      code: "CATALOG_NOT_LOADED",
    });
    await expect(service.isOnboardingComplete()).resolves.toBe(false);
  });

  it("does not complete onboarding when a profile is missing required skills", async () => {
    const service = createService({
      skills: [await createSkill("fullstack-staff", "# Fullstack\n")],
      tools: [],
    });
    await service.refreshCatalog();

    await expect(service.installProfile("fullstack")).rejects.toMatchObject({
      code: "SKILLS_NOT_IN_CATALOG",
    });
    await expect(service.isOnboardingComplete()).resolves.toBe(false);
  });

  it("installs every required skill before marking onboarding complete", async () => {
    const fullstack = await createSkill("fullstack-staff", "# Fullstack\n");
    const database = await createSkill("database-staff", "# Database\n");
    const service = createService({ skills: [fullstack, database], tools: [] }, {
      [fullstack.downloadUrl]: "# Fullstack\n",
      [database.downloadUrl]: "# Database\n",
    });
    await service.refreshCatalog();

    await service.installProfile("fullstack");

    await expect(service.isOnboardingComplete()).resolves.toBe(true);
    await expect(service.skillsInstaller.listInstalled()).resolves.toHaveLength(2);
  });
});

describe("Plan-based skill gating", () => {
  it("marks free skills as unlocked for any tier", async () => {
    const freeSkill = await createSkill("free-skill", "# Free\n");
    freeSkill.tier = "free";
    const service = createService({ skills: [freeSkill], tools: [] });
    await service.refreshCatalog();

    const snapshot = await service.snapshot("free");
    const view = snapshot.skills.find((s) => s.id === "free-skill")!;

    expect(view.installState).toBe("available");
    expect(view.lockResult).toEqual({ locked: false });
  });

  it("locks pro skills for free users with reason", async () => {
    const proSkill = await createSkill("pro-skill", "# Pro\n");
    proSkill.tier = "pro";
    const service = createService({ skills: [proSkill], tools: [] });
    await service.refreshCatalog();

    const snapshot = await service.snapshot("free");
    const view = snapshot.skills.find((s) => s.id === "pro-skill")!;

    expect(view.installState).toBe("locked");
    expect(view.lockResult?.locked).toBe(true);
    expect(view.lockResult?.requiredTier).toBe("pro");
    expect(view.lockResult?.reason).toBe("Pro plan required");
    expect(view.lockResult?.upgradeLabel).toBe("Upgrade to Pro");
  });

  it("unlocks pro skills for pro users", async () => {
    const proSkill = await createSkill("pro-skill", "# Pro\n");
    proSkill.tier = "pro";
    const service = createService({ skills: [proSkill], tools: [] });
    await service.refreshCatalog();

    const snapshot = await service.snapshot("pro");
    const view = snapshot.skills.find((s) => s.id === "pro-skill")!;

    expect(view.installState).toBe("available");
    expect(view.lockResult).toEqual({ locked: false });
  });

  it("locks enterprise skills for free and pro users", async () => {
    const entSkill = await createSkill("ent-skill", "# Ent\n");
    entSkill.tier = "enterprise";
    const service = createService({ skills: [entSkill], tools: [] });
    await service.refreshCatalog();

    const freeSnapshot = await service.snapshot("free");
    const freeView = freeSnapshot.skills.find((s) => s.id === "ent-skill")!;
    expect(freeView.installState).toBe("locked");
    expect(freeView.lockResult?.requiredTier).toBe("enterprise");
    expect(freeView.lockResult?.reason).toBe("Enterprise plan required");

    const proSnapshot = await service.snapshot("pro");
    const proView = proSnapshot.skills.find((s) => s.id === "ent-skill")!;
    expect(proView.installState).toBe("locked");
    expect(proView.lockResult?.locked).toBe(true);
  });

  it("unlocks enterprise skills for enterprise and team users", async () => {
    const entSkill = await createSkill("ent-skill", "# Ent\n");
    entSkill.tier = "enterprise";
    const service = createService({ skills: [entSkill], tools: [] });
    await service.refreshCatalog();

    const entSnapshot = await service.snapshot("enterprise");
    const entView = entSnapshot.skills.find((s) => s.id === "ent-skill")!;
    expect(entView.installState).toBe("available");
    expect(entView.lockResult).toEqual({ locked: false });

    const teamSnapshot = await service.snapshot("team");
    const teamView = teamSnapshot.skills.find((s) => s.id === "ent-skill")!;
    expect(teamView.installState).toBe("available");
    expect(teamView.lockResult).toEqual({ locked: false });
  });

  it("defaults to Free when userTier is undefined", async () => {
    const proSkill = await createSkill("pro-skill", "# Pro\n");
    proSkill.tier = "pro";
    const service = createService({ skills: [proSkill], tools: [] });
    await service.refreshCatalog();

    const snapshot = await service.snapshot(undefined);
    const view = snapshot.skills.find((s) => s.id === "pro-skill")!;

    expect(view.installState).toBe("locked");
    expect(view.lockResult?.locked).toBe(true);
  });
});

function createService(catalog: MarketplaceCatalog, responses: Record<string, string> = {}): MarketplaceService {
  const storage = new MemoryKeyValueStore();
  const fileSystem = new MemoryMarketplaceFileSystem();
  const registry = {
    fetchCatalog: async () => catalog,
  } as unknown as MarketplaceRegistry;
  const fetcher = async (url: string | URL | Request) => {
    const key = String(url);
    return new Response(responses[key] ?? "", { status: 200 });
  };
  return new MarketplaceService(
    storage,
    registry,
    new SkillsInstaller(storage, fileSystem, fetcher),
    new ToolsInstaller(storage, fileSystem),
  );
}

async function createSkill(id: string, content: string): Promise<Skill> {
  return {
    id,
    name: id,
    description: `${id} production skill.`,
    category: id.includes("database") ? "backend" : "fullstack",
    tier: "pro",
    version: "1.0.0",
    downloadUrl: `https://cdn.oclushion.com/skills/${id}.md`,
    sha256: await sha256Hex(content),
    sizeKb: 1,
    keywords: [id],
    previewLines: [content.trim()],
  };
}
