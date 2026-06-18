import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, readTextFile, writeTextFile, remove } from "@tauri-apps/plugin-fs";
import { createHash } from "../crypto/hash";
import { logger } from "../utils/logger";
import type { FileWatcherService } from "../editor/file-watcher.service";
import type { DependencyGraph } from "../context.service";
import type { RepoScanResult } from "../repo-scanner";

export type RepoGraphCacheMeta = {
  rootPath: string;
  lastScan: string;
  fileCount: number;
  configHash: string;
  version: number;
};

export const CACHE_VERSION = 1;

export class RepoGraphCacheService {
  private cacheDir: string | null = null;
  private configPaths: string[] = [];
  private fileWatcherDispose: (() => void) | null = null;

  public constructor(
    private readonly fileWatcher?: FileWatcherService,
  ) {}

  public async initialize(rootPath: string): Promise<void> {
    const appData = await appDataDir();
    this.cacheDir = await join(appData, "cache", "repo-graph");
    await ensureDirectory(this.cacheDir);
    this.configPaths = [
      await join(rootPath, "package.json"),
      await join(rootPath, "tsconfig.json"),
    ];
    void this.setupFileWatcher(rootPath);
  }

  public async getScanResult(rootPath: string): Promise<RepoScanResult | null> {
    const dir = this.cacheDir;
    if (!dir) return null;
    const hash = await computeRepoHash(rootPath);
    const path = await join(dir, `${hash}.scan.json`);
    if (!(await exists(path))) return null;
    try {
      const raw = await readTextFile(path);
      return JSON.parse(raw) as RepoScanResult;
    } catch {
      return null;
    }
  }

  public async getDependencyGraph(rootPath: string): Promise<DependencyGraph | null> {
    const dir = this.cacheDir;
    if (!dir) return null;
    const hash = await computeRepoHash(rootPath);
    const path = await join(dir, `${hash}.graph.json`);
    if (!(await exists(path))) return null;
    try {
      const raw = await readTextFile(path);
      return JSON.parse(raw) as DependencyGraph;
    } catch {
      return null;
    }
  }

  public async setScanResult(rootPath: string, scan: RepoScanResult): Promise<void> {
    const dir = this.cacheDir;
    if (!dir) return;
    const hash = await computeRepoHash(rootPath);
    const configHash = await computeConfigHash(this.configPaths);
    const path = await join(dir, `${hash}.scan.json`);
    await writeTextFile(path, JSON.stringify(scan));
    await this.writeMeta(rootPath, hash, scan.totalFiles, configHash);
  }

  public async setDependencyGraph(rootPath: string, graph: DependencyGraph): Promise<void> {
    const dir = this.cacheDir;
    if (!dir) return;
    const hash = await computeRepoHash(rootPath);
    const path = await join(dir, `${hash}.graph.json`);
    await writeTextFile(path, JSON.stringify(graph));
  }

  public async getCachedOrFresh(
    rootPath: string,
    options: {
      scanCache: () => Promise<RepoScanResult | null>;
      graphCache: () => Promise<DependencyGraph | null>;
      scanFactory: () => Promise<RepoScanResult>;
      graphFactory: (result: RepoScanResult) => DependencyGraph;
    },
  ): Promise<{ scan: RepoScanResult; graph: DependencyGraph }> {
    const meta = await this.readMeta(rootPath);
    if (meta && !(await this.isConfigStale(meta))) {
      const cachedScan = await options.scanCache();
      const cachedGraph = await options.graphCache();
      if (cachedScan && cachedGraph) {
        logger.info("RepoGraphCache", "Cache hit for", rootPath);
        return { scan: cachedScan, graph: cachedGraph };
      }
    }

    logger.info("RepoGraphCache", `Cache miss for ${rootPath} - scanning`);
    const scan = await options.scanFactory();
    const graph = options.graphFactory(scan);
    await this.setScanResult(rootPath, scan);
    await this.setDependencyGraph(rootPath, graph);
    return { scan, graph };
  }

  public async invalidate(rootPath: string): Promise<void> {
    const dir = this.cacheDir;
    if (!dir) return;
    const hash = await computeRepoHash(rootPath);
    for (const suffix of [".scan.json", ".graph.json", ".meta.json"]) {
      const path = await join(dir, `${hash}${suffix}`);
      try {
        await remove(path);
      } catch {
        logger.debug("RepoGraphCache", "Failed to remove:", path);
      }
    }
  }

  public async invalidateAll(): Promise<void> {
    const dir = this.cacheDir;
    if (!dir) return;
    try {
      const entries = await readDir(dir);
      const cacheSuffixes = [".scan.json", ".graph.json", ".meta.json"];
      const removals = entries
        .filter((entry) => entry.name && cacheSuffixes.some((s) => entry.name!.endsWith(s)))
        .map((entry) => join(dir, entry.name!).then((p) => remove(p).catch(() => undefined)));
      await Promise.all(removals);
    } catch {
      logger.warn("RepoGraphCache", "Failed to list or clear cache directory:", dir);
    }
  }

  private async setupFileWatcher(rootPath: string): Promise<void> {
    if (!this.fileWatcher) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    this.fileWatcherDispose = this.fileWatcher.subscribe(async (event) => {
      if (event.type === "modified" || event.type === "created" || event.type === "deleted") {
        const relative = event.path.replace(rootPath.replaceAll("\\", "/"), "").replace(/^\//, "");
        if (
          relative === "package.json" ||
          relative === "tsconfig.json" ||
          relative.endsWith(".ts") ||
          relative.endsWith(".tsx") ||
          relative.endsWith(".js") ||
          relative.endsWith(".jsx")
        ) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            debounceTimer = null;
            logger.info("RepoGraphCache", "Invalidating cache due to file change:", relative);
            void this.invalidate(rootPath);
          }, 300);
        }
      }
    });
  }

  private async writeMeta(rootPath: string, hash: string, fileCount: number, configHash: string): Promise<void> {
    const dir = this.cacheDir;
    if (!dir) return;
    const meta: RepoGraphCacheMeta = {
      rootPath,
      lastScan: new Date().toISOString(),
      fileCount,
      configHash,
      version: CACHE_VERSION,
    };
    const path = await join(dir, `${hash}.meta.json`);
    await writeTextFile(path, JSON.stringify(meta));
  }

  private async readMeta(rootPath: string): Promise<RepoGraphCacheMeta | null> {
    const dir = this.cacheDir;
    if (!dir) return null;
    const hash = await computeRepoHash(rootPath);
    const path = await join(dir, `${hash}.meta.json`);
    if (!(await exists(path))) return null;
    try {
      const raw = await readTextFile(path);
      const meta = JSON.parse(raw) as RepoGraphCacheMeta;
      if (meta.version !== CACHE_VERSION) return null;
      return meta;
    } catch {
      return null;
    }
  }

  private async isConfigStale(meta: RepoGraphCacheMeta): Promise<boolean> {
    const currentHash = await computeConfigHash(this.configPaths);
    return currentHash !== meta.configHash;
  }

  public async destroy(): Promise<void> {
    this.fileWatcherDispose?.();
    this.fileWatcherDispose = null;
    this.cacheDir = null;
  }
}

async function computeRepoHash(rootPath: string): Promise<string> {
  const hashInput = `${rootPath}-${CACHE_VERSION}`;
  return createHash(hashInput);
}

async function computeConfigHash(configPaths: string[]): Promise<string> {
  const parts: string[] = [];
  for (const path of configPaths) {
    try {
      const content = await readTextFile(path);
      parts.push(content);
    } catch {
      parts.push(`missing:${path}`);
    }
  }
  return createHash(parts.join("||"));
}

async function ensureDirectory(dir: string): Promise<void> {
  try {
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
  } catch (error) {
    logger.warn("RepoGraphCache", `Failed to create cache directory: ${dir}`, error);
  }
}
