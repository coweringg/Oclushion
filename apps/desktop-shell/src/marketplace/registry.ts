import type { AiTool, MarketplaceCatalog, Skill } from "./marketplace.types";
import { FALLBACK_CATALOG } from "./fallback-catalog";
import { getControlApiUrl } from "../auth.service";
import { createPersistentStore, type KeyValueStore } from "../persistent-store";
import { logger } from "../utils/logger";

export type MarketplaceFetcher = Pick<typeof globalThis, "fetch">["fetch"];

export const DEFAULT_MARKETPLACE_CATALOG_URL =
  "https://cdn.oclushion.com/marketplace/v1/catalog.json";

const CACHE_KEY = "ocl_marketplace_catalog_v2";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

type CacheEntry = {
  timestamp: number;
  catalog: MarketplaceCatalog;
};

async function verifyCatalogHmac(json: string, hmacB64: string, keyHex: string): Promise<boolean> {
  try {
    const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sigBytes = Uint8Array.from(atob(hmacB64), (c) => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(json);
    return await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
  } catch {
    return false;
  }
}

export class MarketplaceRegistry {
  private fallback = validateCatalog(FALLBACK_CATALOG);
  private storePromise: Promise<KeyValueStore> | null = null;
  private hmacKey: string | null;

  public constructor(
    private readonly catalogUrl = readCatalogUrl(),
    private readonly fetcher: MarketplaceFetcher = globalThis.fetch.bind(globalThis),
    hmacKey?: string,
  ) {
    this.hmacKey = hmacKey ?? readHmacKey();
  }

  private async getStore(): Promise<KeyValueStore> {
    if (!this.storePromise) {
      this.storePromise = createPersistentStore();
    }
    return this.storePromise;
  }

  public async fetchCatalog(): Promise<MarketplaceCatalog> {
    const store = await this.getStore();
    const cached = await this.loadCachedCatalog(store);
    if (cached) return cached;

    const sources = this.buildSourceList();

    for (const source of sources) {
      try {
        const response = await this.fetcher(source, {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) continue;
        const payload = (await response.json()) as unknown;
        const catalog = validateCatalog(payload);

        if (this.hmacKey && source === this.catalogUrl) {
          const json = JSON.stringify(payload);
          const hmacUrl = source.replace(/\.json$/, ".hmac");
          const hmacResponse = await this.fetcher(hmacUrl, { cache: "no-store" });
          if (hmacResponse.ok) {
            const hmacBody = (await hmacResponse.text()).trim();
            const valid = await verifyCatalogHmac(json, hmacBody, this.hmacKey);
            if (!valid) {
              logger.warn("MarketplaceRegistry", "HMAC verification failed — catalog may be tampered, falling through");
              continue;
            }
            logger.debug("MarketplaceRegistry", "HMAC verification passed");
          } else {
            logger.warn("MarketplaceRegistry", "HMAC file not found at ${hmacUrl}, skipping verification");
          }
        }

        await this.cacheCatalog(store, catalog);
        return catalog;
      } catch {
        logger.debug("MarketplaceRegistry", `Failed to fetch catalog from ${source}`);
      }
    }

    const stale = await this.loadCachedCatalog(store);
    if (stale) return stale;

    logger.warn("MarketplaceRegistry", "All catalog sources failed, using fallback catalog");
    return this.fallback;
  }

  public async loadCatalogSafe(): Promise<MarketplaceCatalog> {
    try {
      return await this.fetchCatalog();
    } catch {
      return this.fallback;
    }
  }

  private buildSourceList(): string[] {
    const sources: string[] = [];

    const controlApiUrl = getControlApiUrl();
    if (controlApiUrl) {
      sources.push(`${controlApiUrl}/v1/marketplace/catalog`);
    }

    sources.push(this.catalogUrl);

    return sources;
  }

  private async cacheCatalog(store: KeyValueStore, catalog: MarketplaceCatalog): Promise<void> {
    try {
      const entry: CacheEntry = { timestamp: Date.now(), catalog };
      await store.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
    }
  }

  private async loadCachedCatalog(store: KeyValueStore): Promise<MarketplaceCatalog | null> {
    try {
      const raw = await store.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry;
      if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_TTL_MS) {
        return null;
      }
      return parsed.catalog ? validateCatalog(parsed.catalog) : null;
    } catch {
      return null;
    }
  }
}

function readCatalogUrl(): string {
  return (
    import.meta.env.VITE_OCLUSHION_MARKETPLACE_CATALOG_URL ??
    DEFAULT_MARKETPLACE_CATALOG_URL
  );
}

function validateCatalog(payload: unknown): MarketplaceCatalog {
  if (!isRecord(payload)) {
    throw new Error("Marketplace catalog must be a JSON object.");
  }
  const skills = validateArray(payload.skills, validateSkill, "skills");
  const tools = validateArray(payload.tools, validateTool, "tools");
  return { skills, tools };
}

function validateArray<T>(value: unknown, validator: (item: unknown) => T, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Marketplace catalog field "${label}" must be an array.`);
  }
  return value.map(validator);
}

function validateSkill(value: unknown): Skill {
  if (!isRecord(value)) {
    throw new Error("Skill entry must be an object.");
  }
  const skill = value as Skill;
  for (const key of ["id", "name", "description", "category", "tier", "version", "downloadUrl", "sha256"] as const) {
    assertString(skill[key], `skill.${key}`);
  }
  if (!/^(https?):\/\//.test(skill.downloadUrl)) {
    throw new Error(`Skill ${skill.id} must use an HTTP or HTTPS download URL.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(skill.sha256)) {
    throw new Error(`Skill ${skill.id} must include a valid SHA-256 checksum.`);
  }
  return {
    ...skill,
    sizeKb: Number(skill.sizeKb),
    keywords: Array.isArray(skill.keywords) ? skill.keywords.map(String) : [],
    previewLines: Array.isArray(skill.previewLines) ? skill.previewLines.map(String) : [],
  };
}

function validateTool(value: unknown): AiTool {
  if (!isRecord(value)) {
    throw new Error("AI Tool entry must be an object.");
  }
  const tool = value as AiTool;
  for (const key of ["id", "name", "description", "version", "downloadUrl", "platform", "requiredBin", "sha256"] as const) {
    assertString(tool[key], `tool.${key}`);
  }
  if (!/^(https?):\/\//.test(tool.downloadUrl)) {
    throw new Error(`Tool ${tool.id} must use an HTTP or HTTPS download URL.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(tool.sha256)) {
    throw new Error(`Tool ${tool.id} must include a valid SHA-256 checksum.`);
  }
  return { ...tool, gitignoreEntry: ".oclushion-tools/" };
}

function readHmacKey(): string | null {
  return import.meta.env.VITE_OCLUSHION_MARKETPLACE_HMAC_KEY ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Marketplace catalog field "${label}" must be a non-empty string.`);
  }
}
