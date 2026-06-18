import { RepoGraphCacheService } from "./repo-graph-cache.service";
import { scanRepository, type RepoScanResult } from "../repo-scanner";
import { buildDependencyGraph, type DependencyGraph } from "../context.service";
import { logger } from "../utils/logger";

export class CachedRepoScanner {
  public constructor(
    private readonly cache: RepoGraphCacheService,
  ) {}

  public async scanWithCache(rootPath: string): Promise<{
    scan: RepoScanResult;
    graph: DependencyGraph;
  }> {
    return this.cache.getCachedOrFresh(rootPath, {
      scanCache: () => this.cache.getScanResult(rootPath),
      graphCache: () => this.cache.getDependencyGraph(rootPath),
      scanFactory: async () => {
        logger.info("CachedRepoScanner", "Starting full repository scan:", rootPath);
        const scan = await scanRepository(rootPath);
        logger.info("CachedRepoScanner", `Scan complete: ${scan.totalFiles} files`);
        return scan;
      },
      graphFactory: (scan) => {
        logger.info("CachedRepoScanner", "Building dependency graph from scan");
        return buildDependencyGraph(scan.files.map((f) => ({
          path: f.path,
          absolutePath: f.absolutePath,
          type: f.type,
          extension: f.extension,
          relevanceScore: f.relevanceScore,
          tokenEstimate: f.tokenEstimate,
          content: "",
        })));
      },
    });
  }
}
