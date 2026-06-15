import type { KeyValueStore } from "../persistent-store";
import { logger } from "../utils/logger";
import { assertSha256 } from "./integrity";
import type { InstalledSkill, Skill, InstallationStep } from "./marketplace.types";
import {
  joinMarketplacePath,
  type MarketplaceFileSystem,
  TauriMarketplaceFileSystem,
} from "./marketplace.storage";
import type { MarketplaceFetcher } from "./registry";
import { getControlApiUrl } from "../auth.service";

const installedSkillsKey = "oclushion.marketplace.installedSkills.v1";
const defaultSkillsDirectory = ".oclushion/skills";

export type InstallProgressCallback = (step: InstallationStep, progress: number) => void;

export class SkillsInstaller {
  private installQueue: Promise<InstalledSkill> = Promise.resolve({} as InstalledSkill);

  public constructor(
    private readonly storage: KeyValueStore,
    private readonly fileSystem: MarketplaceFileSystem = new TauriMarketplaceFileSystem(),
    private readonly fetcher: MarketplaceFetcher = globalThis.fetch.bind(globalThis),
    private readonly skillsDirectory = defaultSkillsDirectory,
  ) {}

  public async listInstalled(): Promise<InstalledSkill[]> {
    return readJsonArray(await this.storage.getItem(installedSkillsKey), validateInstalledSkill);
  }

  public async install(skill: Skill, onProgress?: InstallProgressCallback): Promise<InstalledSkill> {
    this.installQueue = this.installQueue.then(() => this.doInstall(skill, onProgress));
    return this.installQueue;
  }

  private async doInstall(skill: Skill, onProgress?: InstallProgressCallback): Promise<InstalledSkill> {
    onProgress?.("downloading", 0);
    const downloadUrl = resolveDownloadUrl(skill.downloadUrl);
    const response = await this.fetcher(downloadUrl, {
      headers: { accept: "text/markdown,text/plain" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Skill ${skill.id} could not be downloaded (${response.status}).`);
    }
    const content = await response.text();
    onProgress?.("downloading", 100);

    onProgress?.("verifying", 0);
    const sha256 = await assertSha256(content, skill.sha256, `skill ${skill.id}`);
    onProgress?.("verifying", 100);

    onProgress?.("writing", 0);
    const contentPath = joinMarketplacePath(this.skillsDirectory, `${skill.id}.md`);
    const now = new Date().toISOString();
    await this.fileSystem.writeText(contentPath, content);
    onProgress?.("writing", 100);

    onProgress?.("activating", 0);
    const installed = await this.listInstalled();
    const previous = installed.find((entry) => entry.id === skill.id);
    const nextEntry: InstalledSkill = {
      id: skill.id,
      version: skill.version,
      category: skill.category,
      contentPath,
      sha256,
      installedAt: previous?.installedAt ?? now,
      updatedAt: now,
    };
    await this.persistInstalled([nextEntry, ...installed.filter((entry) => entry.id !== skill.id)]);
    onProgress?.("activating", 100);

    return nextEntry;
  }

  public async uninstall(skillId: string): Promise<void> {
    const installed = await this.listInstalled();
    const entry = installed.find((item) => item.id === skillId);
    if (entry) {
      await this.fileSystem.remove(entry.contentPath);
    }
    await this.persistInstalled(installed.filter((item) => item.id !== skillId));
  }

  public async readInstalledContents(): Promise<Array<{ id: string; version: string; content: string }>> {
    const installed = await this.listInstalled();
    const contents = await Promise.all(
      installed.map(async (entry) => ({
        id: entry.id,
        version: entry.version,
        content: (await this.fileSystem.readText(entry.contentPath)) ?? "",
      })),
    );
    return contents.filter((entry) => entry.content.trim().length > 0);
  }

  private async persistInstalled(entries: InstalledSkill[]): Promise<void> {
    await this.storage.setItem(installedSkillsKey, JSON.stringify(entries));
  }
}

function validateInstalledSkill(value: unknown): InstalledSkill | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entry = value as InstalledSkill;
  return typeof entry.id === "string" &&
    typeof entry.version === "string" &&
    typeof entry.contentPath === "string" &&
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
    logger.warn('SkillsInstaller', 'Failed to parse installed skills from storage', error);
    return [];
  }
}

function resolveDownloadUrl(url: string): string {
  if (url.startsWith("/")) {
    const baseUrl = getControlApiUrl();
    if (baseUrl) {
      return `${baseUrl}${url}`;
    }
  }
  return url;
}
