import { Command } from "@tauri-apps/plugin-shell";
import { logger } from "../utils/logger.js";

export type GitFileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked" | "unchanged";

export type GitStatusMap = Map<string, GitFileStatus>;

const STATUS_MAP: Record<string, GitFileStatus> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  "?": "untracked",
};

export class GitStatusService {
  private cache: GitStatusMap = new Map();
  private rootPath: string = "";
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  async refresh(rootPath: string): Promise<GitStatusMap> {
    this.rootPath = rootPath;
    this.cache.clear();

    try {
      const output = await Command.create("git", ["status", "--porcelain"], {
        cwd: rootPath,
      }).execute();

      if (output.code !== 0) return this.cache;

      const lines = output.stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        const statusCode = line.slice(0, 2).trim();
        const rest = line.slice(3).trim();
        if (!rest || !statusCode) continue;

        const status = STATUS_MAP[statusCode.charAt(0)] ?? "unchanged";

        if (status === "renamed" && rest.includes(" -> ")) {
          const newPath = rest.split(" -> ").pop()?.trim();
          if (newPath) this.cache.set(newPath, "renamed");
        } else {
          this.cache.set(rest, status);
        }
      }
    } catch (err) {
      logger.warn("GitStatus", "Failed to run git status:", err);
    }

    return this.cache;
  }

  getStatus(filePath: string): GitFileStatus {
    return this.cache.get(filePath) ?? "unchanged";
  }

  getStatuses(): GitStatusMap {
    return new Map(this.cache);
  }

  startAutoRefresh(rootPath: string, intervalMs = 30_000): void {
    this.stopAutoRefresh();
    const poll = async () => {
      await this.refresh(rootPath);
      this.refreshTimer = setTimeout(poll, intervalMs);
    };
    void poll();
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  destroy(): void {
    this.stopAutoRefresh();
    this.cache.clear();
  }
}
