import { describe, expect, it } from "vitest";
import { MemoryKeyValueStore } from "../persistent-store";
import { sha256Hex } from "./integrity";
import type { Skill } from "./marketplace.types";
import { MemoryMarketplaceFileSystem } from "./marketplace.storage";
import { SkillsInstaller } from "./skills.installer";

describe("SkillsInstaller", () => {
  it("downloads, verifies SHA-256 and persists installed skill metadata", async () => {
    const content = "# Staff Fullstack\n\nAlways require tests.";
    const skill = await createSkill(content);
    const storage = new MemoryKeyValueStore();
    const fileSystem = new MemoryMarketplaceFileSystem();
    const installer = new SkillsInstaller(
      storage,
      fileSystem,
      async () => new Response(content, { status: 200 }),
      ".oclushion-test/skills",
    );

    const installed = await installer.install(skill);
    const list = await installer.listInstalled();
    const contents = await installer.readInstalledContents();

    expect(installed.id).toBe(skill.id);
    expect(installed.sha256).toBe(skill.sha256);
    expect(list).toHaveLength(1);
    expect(contents[0]?.content).toContain("Always require tests");
  });

  it("rejects a skill when the downloaded content does not match the declared checksum", async () => {
    const skill = await createSkill("trusted content");
    const installer = new SkillsInstaller(
      new MemoryKeyValueStore(),
      new MemoryMarketplaceFileSystem(),
      async () => new Response("tampered content", { status: 200 }),
    );

    await expect(installer.install(skill)).rejects.toThrow(/Integrity check failed/u);
  });
});

async function createSkill(content: string): Promise<Skill> {
  return {
    id: "fullstack-staff",
    name: "Fullstack Staff Engineer",
    description: "Production-grade TypeScript and architecture guidance.",
    category: "fullstack",
    tier: "pro",
    version: "1.0.0",
    downloadUrl: "https://cdn.oclushion.com/skills/fullstack-staff.md",
    sha256: await sha256Hex(content),
    sizeKb: 4,
    keywords: ["typescript", "fullstack", "tests"],
    previewLines: ["Always require tests."],
  };
}
