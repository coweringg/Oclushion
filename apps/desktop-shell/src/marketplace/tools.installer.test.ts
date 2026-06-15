import { describe, expect, it } from "vitest";
import { MemoryKeyValueStore } from "../persistent-store";
import { sha256Hex } from "./integrity";
import type { AiTool } from "./marketplace.types";
import { MemoryMarketplaceFileSystem } from "./marketplace.storage";
import { ToolsInstaller } from "./tools.installer";

describe("ToolsInstaller", () => {
  it("protects .gitignore before writing downloaded tool files", async () => {
    const binary = new TextEncoder().encode("graph binary").buffer;
    const tool = await createTool(binary);
    const fileSystem = new MemoryMarketplaceFileSystem();
    const installer = new ToolsInstaller(
      new MemoryKeyValueStore(),
      fileSystem,
      async () => new Response(binary, { status: 200 }),
    );

    await installer.install("C:/repo", tool);

    expect(fileSystem.writes[0]).toBe("C:/repo/.gitignore");
    expect(fileSystem.writes.some((path) => path.includes(".oclushion-tools/graphify"))).toBe(true);
    expect(fileSystem.binaryWrites).toEqual(["C:/repo/.oclushion-tools/graphify/graphify.exe"]);
    expect(await fileSystem.readText("C:/repo/.oclushion-tools/graphify/graphify.exe")).toBeNull();
    expect(fileSystem.readBinary("C:/repo/.oclushion-tools/graphify/graphify.exe")).toEqual(new Uint8Array(binary));
    expect(await fileSystem.readText("C:/repo/.gitignore")).toContain(".oclushion-tools/");
  });

  it("does not write tool files when integrity verification fails", async () => {
    const binary = new TextEncoder().encode("trusted").buffer;
    const tool = await createTool(binary);
    const fileSystem = new MemoryMarketplaceFileSystem();
    const installer = new ToolsInstaller(
      new MemoryKeyValueStore(),
      fileSystem,
      async () => new Response(new TextEncoder().encode("tampered").buffer, { status: 200 }),
    );

    await expect(installer.install("C:/repo", tool)).rejects.toThrow(/Integrity check failed/u);
    expect(fileSystem.writes).toEqual(["C:/repo/.gitignore"]);
  });
});

async function createTool(binary: ArrayBuffer): Promise<AiTool> {
  return {
    id: "graphify",
    name: "Graphify",
    description: "Repository graph generator.",
    version: "1.0.0",
    downloadUrl: "https://cdn.oclushion.com/tools/graphify/windows/graphify.exe",
    platform: "windows",
    requiredBin: "graphify.exe",
    gitignoreEntry: ".oclushion-tools/",
    sha256: await sha256Hex(binary),
  };
}
