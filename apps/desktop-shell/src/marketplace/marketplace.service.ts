import type { KeyValueStore } from "../persistent-store";
import { compareSemver } from "../skillpacks/skillpack.manager";
import { SkillsDetector } from "./skills.detector";
import { escapeXml } from "../utils/escape-xml.js";
import { SkillsInstaller } from "./skills.installer";
import type {
  AiTool,
  MarketplaceCatalog,
  MarketplaceSnapshot,
  MarketplaceSkillView,
  MarketplaceToolView,
  Skill,
  SuggestedSkill,
  WorkProfile,
  WorkProfileId,
  LockResult,
  MarketplacePlanTier,
  UserTier,
} from "./marketplace.types";
import { MarketplaceRegistry } from "./registry";
import { ToolsInstaller } from "./tools.installer";
import { PurchaseService } from "./purchase.service";
import { normalizeTier } from "../billing/license-validator.js";

const onboardingKey = "oclushion.marketplace.onboardingComplete.v1";

export type MarketplaceErrorCode = "CATALOG_NOT_LOADED" | "UNKNOWN_PROFILE" | "SKILLS_NOT_IN_CATALOG";

export class MarketplaceError extends Error {
  public constructor(
    public readonly code: MarketplaceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MarketplaceError";
  }
}

export const workProfiles: WorkProfile[] = [
  {
    id: "fullstack",
    name: "Full Stack Developer",
    description: "TypeScript, backend, frontend and architecture skill coverage.",
    coreSkillIds: ["fullstack-staff", "database-staff"],
  },
  {
    id: "frontend",
    name: "Frontend / UX Engineer",
    description: "UI engineering, animation systems and product polish.",
    coreSkillIds: ["gsap-animations-staff", "fullstack-staff"],
  },
  {
    id: "backend",
    name: "Backend / DevOps Engineer",
    description: "APIs, deployment, infrastructure and database reliability.",
    coreSkillIds: ["database-staff", "aws-infra-architect"],
  },
  {
    id: "data",
    name: "Data Scientist / ML",
    description: "Data pipelines, analysis, model evaluation and safe context.",
    coreSkillIds: ["database-staff"],
  },
  {
    id: "security",
    name: "Cybersecurity Auditor",
    description: "OWASP review, threat modeling and hardening-first workflows.",
    coreSkillIds: ["security-owasp"],
  },
];

export class MarketplaceService {
  private catalog: MarketplaceCatalog = { skills: [], tools: [] };
  private purchaseService: PurchaseService;

  public constructor(
    private readonly storage: KeyValueStore,
    private readonly registry = new MarketplaceRegistry(),
    public readonly skillsInstaller = new SkillsInstaller(storage),
    public readonly toolsInstaller = new ToolsInstaller(storage),
    private readonly detector = new SkillsDetector(),
  ) {
    this.purchaseService = new PurchaseService(storage);
  }

  public async refreshCatalog(): Promise<MarketplaceCatalog> {
    this.catalog = await this.registry.fetchCatalog();
    return this.catalog;
  }

  public getCatalog(): MarketplaceCatalog {
    return this.catalog;
  }

  public async evaluateLock(skill: Skill, userTier: UserTier | undefined): Promise<LockResult> {
    if ((skill as any).priceUsd > 0) {
      const hasPurchased = this.purchaseService.hasPurchased(skill.id);
      if (!hasPurchased) {
        return {
          locked: true,
          reason: "Este asset requiere ser comprado en el Marketplace.",
          upgradeLabel: `Comprar por $${(skill as any).priceUsd}`,
        };
      }
    }

    return resolveLock(skill.tier, userTier);
  }

  public async snapshot(userTier: UserTier | undefined): Promise<MarketplaceSnapshot> {
    const normalizedTier = normalizeTier(userTier);
    const [installedSkills, installedTools] = await Promise.all([
      this.skillsInstaller.listInstalled(),
      this.toolsInstaller.listInstalled(),
    ]);
    return {
      skills: await Promise.all(this.catalog.skills.map(async (skill) => {
        const installed = installedSkills.find((entry) => entry.id === skill.id);
        const lockResult = await this.evaluateLock(skill, normalizedTier);
        const installState: MarketplaceSkillView["installState"] = lockResult.locked
          ? lockResult.upgradeLabel?.startsWith("Comprar") ? "locked_requires_purchase" : "locked"
          : !installed
            ? "available"
            : compareSemver(skill.version, installed.version) > 0
              ? "update_available"
              : "installed";
        return { ...skill, installState, lockResult };
      })),
      tools: this.catalog.tools.map((tool) => {
        const installed = installedTools.find((entry) => entry.id === tool.id);
        const installState: MarketplaceToolView["installState"] = !installed
          ? "available"
          : compareSemver(tool.version, installed.version) > 0
            ? "update_available"
            : "installed";
        return { ...tool, installState };
      }),
      installedSkills,
      installedTools,
    };
  }

  public async installSkill(skillId: string, onProgress?: (step: string, progress: number) => void): Promise<void> {
    const skill = this.findSkill(skillId);
    await this.skillsInstaller.install(skill, onProgress);
  }

  public async uninstallSkill(skillId: string): Promise<void> {
    await this.skillsInstaller.uninstall(skillId);
  }

  public async installTool(projectRoot: string, toolId: string): Promise<void> {
    const tool = this.findTool(toolId);
    await this.toolsInstaller.install(projectRoot, tool);
  }

  public async uninstallTool(projectRoot: string, toolId: string): Promise<void> {
    await this.toolsInstaller.uninstall(projectRoot, toolId);
  }

  public async installProfile(profileId: WorkProfileId): Promise<void> {
    if (!this.catalog.skills.length) {
      throw new MarketplaceError(
        "CATALOG_NOT_LOADED",
        "Marketplace catalog is not loaded. Connect to the Oclushion Marketplace CDN and retry before completing onboarding.",
      );
    }
    const profile = workProfiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      throw new MarketplaceError("UNKNOWN_PROFILE", `Unknown work profile: ${profileId}.`);
    }
    const skillsById = new Map(this.catalog.skills.map((skill) => [skill.id, skill]));
    const missing = profile.coreSkillIds.filter((skillId) => !skillsById.has(skillId));
    if (missing.length) {
      throw new MarketplaceError(
        "SKILLS_NOT_IN_CATALOG",
        `Work profile ${profileId} cannot be installed because required skills are missing from the catalog: ${missing.join(", ")}.`,
      );
    }
    for (const skillId of profile.coreSkillIds) {
      await this.skillsInstaller.install(skillsById.get(skillId)!);
    }
    await this.storage.setItem(onboardingKey, JSON.stringify({ profileId, completedAt: new Date().toISOString() }));
  }

  public async isOnboardingComplete(): Promise<boolean> {
    return Boolean(await this.storage.getItem(onboardingKey));
  }

  public async initializeEmbedder(): Promise<void> {
    await this.detector.initializeEmbedder();
  }

  public async suggestSkill(userMessage: string, userTier?: string): Promise<SuggestedSkill | null> {
    const installed = await this.skillsInstaller.listInstalled();
    return this.detector.suggest(
      userMessage,
      this.catalog.skills,
      installed.map((entry) => entry.id),
      userTier,
    );
  }

  public async buildInstalledSkillsContext(): Promise<string> {
    const skills = await this.skillsInstaller.readInstalledContents();
    if (!skills.length) {
      return "";
    }
    return [
      "<installed_marketplace_skills>",
      ...skills.map(
        (skill) =>
          `  <skill id="${escapeXml(skill.id)}" version="${escapeXml(skill.version)}"><![CDATA[\n${skill.content}\n  ]]></skill>`,
      ),
      "</installed_marketplace_skills>",
    ].join("\n");
  }

  private findSkill(skillId: string): Skill {
    const skill = this.catalog.skills.find((candidate) => candidate.id === skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} is not available in the marketplace catalog.`);
    }
    return skill;
  }

  private findTool(toolId: string): AiTool {
    const tool = this.catalog.tools.find((candidate) => candidate.id === toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} is not available in the marketplace catalog.`);
    }
    return tool;
  }
}

function resolveLock(tier: string, userTier: string | undefined): LockResult {
  const normalized = (userTier ?? "free").trim().toLowerCase();
  if (tier === "free") {
    return { locked: false };
  }
  if (tier === "pro") {
    if (normalized === "free") {
      return {
        locked: true,
        requiredTier: "pro",
        reason: "Pro plan required",
        upgradeLabel: "Upgrade to Pro",
      };
    }
    return { locked: false };
  }
  if (normalized === "enterprise" || normalized === "team") {
    return { locked: false };
  }
  return {
    locked: true,
    requiredTier: "enterprise",
    reason: "Enterprise plan required",
    upgradeLabel: "Upgrade to Enterprise",
  };
}
