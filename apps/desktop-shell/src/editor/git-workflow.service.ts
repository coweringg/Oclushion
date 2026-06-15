import { Command } from "@tauri-apps/plugin-shell";
import { logger } from "../utils/logger";

export interface GitBranchInfo {
  name: string;
  current: boolean;
  remote?: string;
  behind?: number;
  ahead?: number;
}

export interface GitCommitLog {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitDiffEntry {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked";
  additions: number;
  deletions: number;
}

export class GitWorkflowService {
  async listBranches(rootPath: string): Promise<GitBranchInfo[]> {
    const result = await Command.create("git", ["branch", "-vv"], { cwd: rootPath }).execute();
    if (result.code !== 0) return [];
    return result.stdout.split("\n").filter(Boolean).map((line) => {
      const current = line.startsWith("*");
      const name = line.replace(/^[* ] /, "").split(/\s+/)[0] ?? "";
      return { name, current };
    });
  }

  async switchBranch(rootPath: string, branch: string): Promise<boolean> {
    const result = await Command.create("git", ["checkout", branch], { cwd: rootPath }).execute();
    return result.code === 0;
  }

  async getLog(rootPath: string, maxCount = 20): Promise<GitCommitLog[]> {
    const result = await Command.create("git", ["log", `--max-count=${maxCount}`, "--format=%H|%an|%ai|%s"], { cwd: rootPath }).execute();
    if (result.code !== 0) return [];
    return result.stdout.split("\n").filter(Boolean).map((line) => {
      const [hash, author, date, ...msgParts] = line.split("|");
      return { hash: hash?.slice(0, 7) ?? "", author: author ?? "", date: date ?? "", message: msgParts.join("|") };
    });
  }

  async getDiff(rootPath: string, staged = false): Promise<GitDiffEntry[]> {
    const args = ["diff", "--numstat"];
    if (staged) args.push("--cached");
    const result = await Command.create("git", args, { cwd: rootPath }).execute();
    if (result.code !== 0) return [];
    return result.stdout.split("\n").filter(Boolean).map((line) => {
      const [additions, deletions, path] = line.split("\t");
      return { path: path ?? "", status: "modified", additions: Number(additions ?? 0), deletions: Number(deletions ?? 0) };
    });
  }

  async stageFile(rootPath: string, filePath: string): Promise<boolean> {
    const result = await Command.create("git", ["add", filePath], { cwd: rootPath }).execute();
    return result.code === 0;
  }

  async unstageFile(rootPath: string, filePath: string): Promise<boolean> {
    const result = await Command.create("git", ["reset", "HEAD", filePath], { cwd: rootPath }).execute();
    return result.code === 0;
  }

  async commit(rootPath: string, message: string): Promise<boolean> {
    const result = await Command.create("git", ["commit", "-m", message], { cwd: rootPath }).execute();
    return result.code === 0;
  }

  async getStagedFiles(rootPath: string): Promise<string[]> {
    const result = await Command.create("git", ["diff", "--cached", "--name-only"], { cwd: rootPath }).execute();
    if (result.code !== 0) return [];
    return result.stdout.split("\n").filter(Boolean);
  }

  async createBranch(rootPath: string, name: string): Promise<boolean> {
    const result = await Command.create("git", ["checkout", "-b", name], { cwd: rootPath }).execute();
    return result.code === 0;
  }
}
