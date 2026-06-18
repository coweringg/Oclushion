import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RepoGraphCacheService } from "./repo-graph-cache.service";
import type { RepoScanResult } from "../repo-scanner";
import type { DependencyGraph } from "../context.service";

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn(async () => "mock://appdata"),
  join: vi.fn(async (...segments: string[]) => segments.join("/")),
}));

vi.mock("@tauri-apps/plugin-fs", () => {
  const store = new Map<string, string>();
  return {
    exists: vi.fn(async (path: string) => store.has(path)),
    mkdir: vi.fn(async () => undefined),
    readDir: vi.fn(async (path: string) => {
      const entries: Array<{ name: string }> = [];
      for (const key of store.keys()) {
        if (key.startsWith(path)) {
          const name = key.slice(path.length + 1);
          entries.push({ name });
        }
      }
      return entries;
    }),
    readTextFile: vi.fn(async (path: string) => {
      const content = store.get(path);
      if (!content) throw new Error("ENOENT");
      return content;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      store.set(path, content);
    }),
    remove: vi.fn(async (path: string) => {
      store.delete(path);
    }),
    __store: store,
  };
});

vi.mock("../crypto/hash", () => ({
  createHash: vi.fn(async (input: string) => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
  }),
}));

describe("RepoGraphCacheService", () => {
  let cache: RepoGraphCacheService;
  const mockRootPath = "mock://project";
  const mockScan: RepoScanResult = {
    rootPath: mockRootPath,
    totalFiles: 10,
    filesByType: { source: 5, config: 2, docs: 1, test: 1, other: 1 },
    detectedFramework: "Vite",
    detectedLanguage: "TypeScript",
    hasTests: true,
    testRatio: 0.2,
    hasDocumentation: true,
    isMonorepo: false,
    packages: ["project"],
    repoSummary: "Mock project",
    files: [],
  };
  const mockGraph: DependencyGraph = { nodes: [] };

  beforeEach(async () => {
    cache = new RepoGraphCacheService();
    await cache.initialize(mockRootPath);
  });

  afterEach(async () => {
    await cache.destroy();
  });

  it("returns null when no cache exists", async () => {
    await expect(cache.getScanResult(mockRootPath)).resolves.toBeNull();
    await expect(cache.getDependencyGraph(mockRootPath)).resolves.toBeNull();
  });

  it("stores and retrieves scan results", async () => {
    await cache.setScanResult(mockRootPath, mockScan);
    const result = await cache.getScanResult(mockRootPath);
    expect(result).not.toBeNull();
    expect(result!.rootPath).toBe(mockRootPath);
    expect(result!.totalFiles).toBe(10);
  });

  it("stores and retrieves dependency graphs", async () => {
    await cache.setDependencyGraph(mockRootPath, mockGraph);
    const result = await cache.getDependencyGraph(mockRootPath);
    expect(result).not.toBeNull();
    expect(result!.nodes).toEqual([]);
  });

  it("invalidates cache entries", async () => {
    await cache.setScanResult(mockRootPath, mockScan);
    await expect(cache.getScanResult(mockRootPath)).resolves.not.toBeNull();
    await cache.invalidate(mockRootPath);
    await expect(cache.getScanResult(mockRootPath)).resolves.toBeNull();
  });

  it("cachedOrFresh returns cached values on hit", async () => {
    await cache.setScanResult(mockRootPath, mockScan);
    await cache.setDependencyGraph(mockRootPath, mockGraph);
    const factory = vi.fn(async () => mockScan);
    const result = await cache.getCachedOrFresh(mockRootPath, {
      scanCache: () => cache.getScanResult(mockRootPath),
      graphCache: () => cache.getDependencyGraph(mockRootPath),
      scanFactory: factory,
      graphFactory: (_s) => mockGraph,
    });
    expect(factory).not.toHaveBeenCalled();
    expect(result.scan.rootPath).toBe(mockRootPath);
  });

  it("cachedOrFresh calls factory on miss", async () => {
    const factory = vi.fn(async () => mockScan);
    const result = await cache.getCachedOrFresh("mock://fresh-project", {
      scanCache: () => cache.getScanResult("mock://fresh-project"),
      graphCache: () => cache.getDependencyGraph("mock://fresh-project"),
      scanFactory: factory,
      graphFactory: (_s) => mockGraph,
    });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(result.scan.rootPath).toBe(mockRootPath);
  });

  it("invalidateAll clears all cached entries", async () => {
    await cache.setScanResult(mockRootPath, mockScan);
    await cache.setDependencyGraph(mockRootPath, mockGraph);
    await expect(cache.getScanResult(mockRootPath)).resolves.not.toBeNull();
    await expect(cache.getDependencyGraph(mockRootPath)).resolves.not.toBeNull();
    await cache.invalidateAll();
    await expect(cache.getScanResult(mockRootPath)).resolves.toBeNull();
    await expect(cache.getDependencyGraph(mockRootPath)).resolves.toBeNull();
  });
});
