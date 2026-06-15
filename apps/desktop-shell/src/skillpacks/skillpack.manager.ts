import { z } from "zod";
import { getControlApiUrl, type OclushionPlan } from "../auth.service";
import { verifyHmac } from "../crypto/hmac";
import { assertSha256 } from "../marketplace/integrity";
import type { KeyValueStore } from "../persistent-store";
import { logger } from "../utils/logger";
import type { InstalledSkillpack, MarketplaceSkillpack, Skillpack } from "../types/skillpack";

const marketplaceCatalogSchema = z.union([
  z.array(z.unknown()),
  z.object({ skillpacks: z.array(z.unknown()) }),
]);

export const bundledSkillpacks: Skillpack[] = [
  {
    id: "senior-fullstack-node",
    name: "Senior Fullstack Node",
    version: "1.0.0",
    role: "fullstack-node",
    planTier: "Free",
    description: "Strict TypeScript, ESM, API design and test discipline for fullstack Node work.",
    systemRules: [
      "Act as a senior fullstack engineer with production-grade TypeScript standards.",
      "Prefer explicit types at module boundaries and avoid broad any types.",
      "Use ESM-compatible imports and keep browser/server boundaries clear.",
      "Always consider tests, failure modes and migration safety before changing code.",
    ],
    forbiddenPatterns: [
      "Broad any types for public interfaces",
      "Unvalidated request bodies",
      "Silent catch blocks",
      "Runtime-only assumptions without tests",
    ],
    requiredPractices: [
      "Preserve existing architecture unless there is a clear reason to change it.",
      "Summarize tests run and any residual risk.",
      "Keep changes scoped to the requested behavior.",
    ],
    outputFormat: {
      style: "implementation-first",
      sections: ["changes", "validation", "risks"],
      requiresTestsSummary: true,
    },
    contextDirectives: [
      "Prioritize package.json, tsconfig, route handlers and shared contracts for Node work.",
      "Include nearby tests and schema files when available.",
    ],
  },
  {
    id: "security-auditor-cso",
    name: "Auditor de Seguridad (CSO)",
    version: "1.0.0",
    role: "security-auditor",
    planTier: "Pro",
    description: "Security review profile for auth, input validation, XSS, SSRF and secret hygiene.",
    systemRules: [
      "Act as a chief security officer reviewing code for production risk.",
      "Treat all external input as hostile until validated.",
      "Check authz, SSRF, XSS, secret handling and auditability.",
      "Prefer fail-closed behavior for security-sensitive flows.",
    ],
    forbiddenPatterns: [
      "Raw HTML insertion without escaping",
      "Network calls to user-controlled hosts without allowlists",
      "Logging secrets, prompts or raw credentials",
      "Security checks implemented only in the UI",
    ],
    requiredPractices: [
      "Explain severity and exploitability for each finding.",
      "Recommend tests that would catch the risk.",
      "Avoid adding untrusted dependencies without justification.",
    ],
    outputFormat: {
      style: "review-first",
      sections: ["findings", "open_questions", "validation"],
      requiresTestsSummary: true,
    },
    contextDirectives: [
      "Prioritize auth, routing, parsing, storage and network boundary files.",
      "Include policy and audit contracts when available.",
    ],
  },
];
export const mockSkillpacks = bundledSkillpacks;

export type SkillpackSnapshot = {
  active: Skillpack;
  installed: InstalledSkillpack[];
};

export type SkillpackListener = (snapshot: SkillpackSnapshot) => void;

type SkillpackPersistedState = {
  activeId: string;
  marketplaceSkillpacks: (Skillpack & { sha256?: string; hmac?: string })[];
};

const skillpackStorageKey = "oclushion.desktop.skillpacks.v2";

export class SkillpackManager {
  private activeSkillpackId = bundledSkillpacks[0]?.id ?? "";
  private marketplaceSkillpacks = new Map<string, Skillpack & { sha256?: string; hmac?: string }>();
  private readonly listeners = new Set<SkillpackListener>();

  private constructor(
    private readonly storage: KeyValueStore,
    private readonly marketplaceUrl = `${getControlApiUrl()}/v1/marketplace/skillpacks`,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  public static async create(options: {
    storage: KeyValueStore;
    marketplaceUrl?: string;
    fetcher?: typeof fetch;
  }): Promise<SkillpackManager> {
    const manager = new SkillpackManager(options.storage, options.marketplaceUrl, options.fetcher);
    await manager.loadPersistedState();
    return manager;
  }

  public listInstalled(): InstalledSkillpack[] {
    return [...bundledSkillpacks, ...this.marketplaceSkillpacks.values()].map((skillpack) => ({
      skillpack,
      state: skillpack.id === this.activeSkillpackId ? "active" : "installed",
    }));
  }

  public getActiveSkillpack(): Skillpack {
    const fallback = getBundledDefault();
    return (
      this.listInstalled().find((installed) => installed.skillpack.id === this.activeSkillpackId)
        ?.skillpack ?? fallback
    );
  }

  public async fetchMarketplace(): Promise<MarketplaceSkillpack[]> {
    const response = await this.fetcher(this.marketplaceUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Marketplace catalog failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = marketplaceCatalogSchema.parse(raw);
    const skillpacks = Array.isArray(payload) ? payload : payload.skillpacks;
    if (!Array.isArray(skillpacks)) {
      throw new Error("Marketplace catalog response is invalid.");
    }
    const verified: MarketplaceSkillpack[] = [];
    for (const raw of skillpacks) {
      if (!isMarketplaceSkillpackPayload(raw)) {
        continue;
      }
      const verification = await this.verifySkillpackIntegrity(raw);
      if (verification.valid) {
        verified.push({ ...raw, installState: this.resolveInstallState(raw) });
      } else {
        logger.warn('SkillpackManager', `Rejected skillpack "${raw.name}": ${verification.reason}`);
      }
    }
    return verified;
  }

  public async install(skillpackId: string): Promise<Skillpack> {
    const marketplaceSkillpack = (await this.fetchMarketplace()).find(
      (skillpack) => skillpack.id === skillpackId,
    );
    if (!marketplaceSkillpack) {
      throw new Error(`Unknown marketplace skillpack: ${skillpackId}`);
    }
    const { author: _author, category: _category, installState: _installState, ...core } = marketplaceSkillpack;
    this.marketplaceSkillpacks.set(core.id, core);
    this.activeSkillpackId = core.id;
    await this.persist();
    this.emit();
    return core;
  }

  public async update(skillpackId: string): Promise<Skillpack> {
    return this.install(skillpackId);
  }

  public async updateAll(): Promise<Skillpack[]> {
    const updates = (await this.fetchMarketplace()).filter(
      (skillpack) => skillpack.installState === "update_available",
    );
    const installed: Skillpack[] = [];
    for (const skillpack of updates) {
      installed.push(await this.install(skillpack.id));
    }
    return installed;
  }

  public async uninstall(skillpackId: string): Promise<void> {
    if (bundledSkillpacks.some((skillpack) => skillpack.id === skillpackId)) {
      return;
    }
    this.marketplaceSkillpacks.delete(skillpackId);
    if (this.activeSkillpackId === skillpackId) {
      this.activeSkillpackId = bundledSkillpacks[0]?.id ?? "";
    }
    await this.persist();
    this.emit();
  }

  public activate(skillpackId: string): Skillpack {
    const skillpack = this.listInstalled().find(
      (installed) => installed.skillpack.id === skillpackId,
    )?.skillpack;
    if (!skillpack) {
      throw new Error(`Skillpack not installed: ${skillpackId}`);
    }
    this.activeSkillpackId = skillpack.id;
    void this.persist();
    this.emit();
    return skillpack;
  }

  public resetToPlanDefault(plan: OclushionPlan = "Free"): Skillpack {
    const fallback = getBundledDefault();
    const defaultSkillpack =
      plan === "Free"
        ? fallback
        : bundledSkillpacks.find((skillpack) => skillpack.planTier === plan) ?? fallback;
    this.activeSkillpackId = defaultSkillpack.id;
    void this.persist();
    this.emit();
    return defaultSkillpack;
  }

  public subscribe(listener: SkillpackListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private snapshot(): SkillpackSnapshot {
    return {
      active: this.getActiveSkillpack(),
      installed: this.listInstalled(),
    };
  }

  private async loadPersistedState(): Promise<void> {
    const raw = await this.storage.getItem(skillpackStorageKey);
    if (!raw) {
      return;
    }
    try {
      const zodParsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(raw));
      if (!zodParsed.success) return;
      const parsed = zodParsed.data as Partial<SkillpackPersistedState>;
      if (Array.isArray(parsed.marketplaceSkillpacks)) {
        for (const skillpack of parsed.marketplaceSkillpacks) {
          if (!isSkillpack(skillpack)) {
            continue;
          }
          const verification = await this.verifySkillpackIntegrity(skillpack);
          if (verification.valid) {
            this.marketplaceSkillpacks.set(skillpack.id, skillpack);
          } else {
            logger.warn('SkillpackManager', `Removing compromised skillpack "${skillpack.name}": ${verification.reason}`);
          }
        }
      }
      if (
        typeof parsed.activeId === "string" &&
        this.listInstalled().some((installed) => installed.skillpack.id === parsed.activeId)
      ) {
        this.activeSkillpackId = parsed.activeId;
      }
    } catch (error) {
      logger.warn('SkillpackManager', 'Failed to load skillpack state, resetting', error);
      await this.storage.removeItem(skillpackStorageKey);
    }
  }

  private async persist(): Promise<void> {
    const state: SkillpackPersistedState = {
      activeId: this.activeSkillpackId,
      marketplaceSkillpacks: [...this.marketplaceSkillpacks.values()],
    };
    await this.storage.setItem(skillpackStorageKey, JSON.stringify(state));
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private async verifySkillpackIntegrity(skillpack: Skillpack & { sha256?: string; hmac?: string }): Promise<{ valid: boolean; reason: string }> {
    if (!skillpack.sha256) {
      return { valid: false, reason: "missing_hash" };
    }
    try {
      const payload = JSON.stringify({
        id: skillpack.id,
        name: skillpack.name,
        version: skillpack.version,
        role: skillpack.role,
        description: skillpack.description,
        systemRules: skillpack.systemRules,
        forbiddenPatterns: skillpack.forbiddenPatterns,
        requiredPractices: skillpack.requiredPractices,
        outputFormat: skillpack.outputFormat,
        contextDirectives: skillpack.contextDirectives,
      });
      await assertSha256(payload, skillpack.sha256, `skillpack:${skillpack.id}`);
      if (skillpack.hmac) {
        const hmacValid = await verifyHmac(payload, skillpack.hmac, "marketplace");
        if (!hmacValid) {
          return { valid: false, reason: "hmac_mismatch" };
        }
      }
      return { valid: true, reason: "valid" };
    } catch {
      return { valid: false, reason: "hash_mismatch" };
    }
  }

  private resolveInstallState(skillpack: Skillpack): MarketplaceSkillpack["installState"] {
    const installed = this.listInstalled().find((candidate) => candidate.skillpack.id === skillpack.id);
    if (!installed) {
      return "available";
    }
    return compareSemver(skillpack.version, installed.skillpack.version) > 0
      ? "update_available"
      : "installed";
  }
}

function getBundledDefault(): Skillpack {
  const fallback = bundledSkillpacks[0];
  if (!fallback) {
    throw new Error("Oclushion requires at least one bundled skillpack.");
  }
  return fallback;
}

function toSkillpack(skillpack: MarketplaceSkillpack): Skillpack {
  const { author: _author, category: _category, installState: _installState, ...core } = skillpack;
  return core;
}

function isMarketplaceSkillpackPayload(value: unknown): value is MarketplaceSkillpack {
  return isSkillpack(value);
}

function isSkillpack(value: unknown): value is Skillpack {
  if (!value || typeof value !== "object") {
    return false;
  }
  const skillpack = value as Partial<Skillpack>;
  return (
    typeof skillpack.id === "string" &&
    typeof skillpack.name === "string" &&
    typeof skillpack.version === "string" &&
    typeof skillpack.role === "string" &&
    typeof skillpack.description === "string" &&
    Array.isArray(skillpack.systemRules) &&
    Array.isArray(skillpack.forbiddenPatterns) &&
    Array.isArray(skillpack.requiredPractices) &&
    Array.isArray(skillpack.contextDirectives)
  );
}

export function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }
  return 0;
}

function parseSemver(version: string): [number, number, number] {
  const [major = "0", minor = "0", patch = "0"] = version.replace(/^v/iu, "").split(".");
  return [major, minor, patch].map((part) => Number.parseInt(part, 10) || 0) as [
    number,
    number,
    number,
  ];
}
