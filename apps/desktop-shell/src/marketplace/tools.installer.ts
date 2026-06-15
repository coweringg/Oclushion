import type { KeyValueStore } from "../persistent-store";
import { logger } from "../utils/logger";
import { assertSha256 } from "./integrity";
import type { AiTool, InstalledTool } from "./marketplace.types";
import {
  joinMarketplacePath,
  type MarketplaceFileSystem,
  TauriMarketplaceFileSystem,
} from "./marketplace.storage";
import type { MarketplaceFetcher } from "./registry";

const installedToolsKey = "oclushion.marketplace.installedTools.v1";

export class ToolsInstaller {
  public constructor(
    private readonly storage: KeyValueStore,
    private readonly fileSystem: MarketplaceFileSystem = new TauriMarketplaceFileSystem(),
    private readonly fetcher: MarketplaceFetcher = globalThis.fetch.bind(globalThis),
  ) {}

  public async listInstalled(): Promise<InstalledTool[]> {
    return readJsonArray(await this.storage.getItem(installedToolsKey), validateInstalledTool);
  }

  public async install(projectRoot: string, tool: AiTool): Promise<InstalledTool> {
    await this.ensureGitignoreProtection(projectRoot, tool.gitignoreEntry);

    const response = await this.fetcher(tool.downloadUrl, {
      headers: { accept: "application/octet-stream,**" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Tool ${tool.id} could not be downloaded (${response.status}).`);
    }
    const bytes = await response.arrayBuffer();
    const sha256 = await assertSha256(bytes, tool.sha256, `tool ${tool.id}`);
    const binary = new Uint8Array(bytes);

    const toolDirectory = joinMarketplacePath(projectRoot, ".oclushion-tools", tool.id);
    const binPath = joinMarketplacePath(toolDirectory, tool.requiredBin);
    const metadataPath = joinMarketplacePath(toolDirectory, "oclushion-tool.json");
    const installed: InstalledTool = {
      id: tool.id,
      version: tool.version,
      platform: tool.platform,
      binPath,
      sha256,
      installedAt: new Date().toISOString(),
    };
    await this.fileSystem.ensureDir(toolDirectory);
    await this.fileSystem.writeBinary(binPath, binary);
    await this.fileSystem.writeText(metadataPath, JSON.stringify(installed, null, 2));
    await markExecutableIfNeeded(tool.platform, binPath);

    const current = await this.listInstalled();
    await this.persistInstalled([installed, ...current.filter((entry) => entry.id !== tool.id)]);
    return installed;
  }

  public async uninstall(projectRoot: string, toolId: string): Promise<void> {
    await this.fileSystem.remove(joinMarketplacePath(projectRoot, ".oclushion-tools", toolId));
    await this.persistInstalled((await this.listInstalled()).filter((entry) => entry.id !== toolId));
  }

  public async ensureGitignoreProtection(projectRoot: string, entry = ".oclushion-tools/"): Promise<void> {
    const gitignorePath = joinMarketplacePath(projectRoot, ".gitignore");
    const current = (await this.fileSystem.readText(gitignorePath)) ?? "";
    const lines = current.split(/\r?\n/).map((line) => line.trim());
    if (lines.includes(entry)) {
      return;
    }
    const next = `${current.replace(/\s*$/, "")}${current.trim() ? "\n" : ""}${entry}\n`;
    await this.fileSystem.writeText(gitignorePath, next);
  }

  private async persistInstalled(entries: InstalledTool[]): Promise<void> {
    await this.storage.setItem(installedToolsKey, JSON.stringify(entries));
  }
}

function validateInstalledTool(value: unknown): InstalledTool | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entry = value as InstalledTool;
  return typeof entry.id === "string" &&
    typeof entry.version === "string" &&
    typeof entry.binPath === "string" &&
    typeof entry.sha256 === "string"
    ? entry
    : null;
}

function readJsonArray<T>(raw: string | null, validator: (value: unknown) => T | null): T[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(validator).filter((value): value is T => Boolean(value)) : [];
  } catch (error) {
    logger.warn('ToolsInstaller', 'Failed to parse installed tools from storage', error);
    return [];
  }
}

async function markExecutableIfNeeded(platform: AiTool["platform"], binPath: string): Promise<void> {
  if (platform === "windows") {
    return;
  }
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return;
  }
  const { Command } = await import("@tauri-apps/plugin-shell");
  await Command.create("chmod", ["+x", binPath]).execute();
}
