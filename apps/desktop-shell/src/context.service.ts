import { readTextFile } from "@tauri-apps/plugin-fs";
import { logger } from "./utils/logger";
import { escapeXml } from "./utils/escape-xml.js";

import type { FileScanResult } from "./repo-scanner";
import type { RepoScanResult } from "./repo-scanner";
import type { SkillsInstaller } from "./marketplace/skills.installer";

export type RepoSourceFile = Pick<
  FileScanResult,
  "path" | "absolutePath" | "type" | "extension" | "relevanceScore" | "tokenEstimate"
> & {
  content: string;
};

export type DependencyGraphNode = {
  path: string;
  imports: string[];
  exports: string[];
  dependsOn: string[];
};

export type DependencyGraph = {
  nodes: DependencyGraphNode[];
};

export type PackedContextFile = {
  path: string;
  content: string;
  tokenEstimate: number;
  relevanceScore: number;
};

export type PackedRepositoryContext = {
  tokenLimit: number;
  usedTokens: number;
  droppedFiles: number;
  files: PackedContextFile[];
};

const importExportPattern =
  /(?:import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["'])|(?:export\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+["']([^"']+)["']))/g;
const sourceExtensions = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);
const contextFileTypes = new Set(["source", "test", "config", "docs", "infra"]);
const defaultMaxContextFilesToRead = 160;

export function parseImportsAndExports(file: RepoSourceFile): DependencyGraphNode {
  const imports = new Set<string>();
  const exports = new Set<string>();
  for (const match of file.content.matchAll(importExportPattern)) {
    const importSpecifier = match[1];
    const exportSpecifier = match[2];
    if (importSpecifier) {
      imports.add(importSpecifier);
    }
    if (exportSpecifier) {
      exports.add(exportSpecifier);
    }
  }

  return {
    path: file.path,
    imports: [...imports],
    exports: [...exports],
    dependsOn: [...imports].filter((specifier) => specifier.startsWith(".") || specifier.startsWith("/")),
  };
}

export function buildDependencyGraph(files: RepoSourceFile[]): DependencyGraph {
  return {
    nodes: files.filter((file) => sourceExtensions.has(file.extension)).map(parseImportsAndExports),
  };
}

export function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

export function packRepositoryContext(
  files: RepoSourceFile[],
  tokenLimit: number,
): PackedRepositoryContext {
  const ranked = files
    .map((file) => ({
      path: file.path,
      content: file.content,
      tokenEstimate: estimateTokens(file.content),
      relevanceScore: file.relevanceScore,
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.tokenEstimate - b.tokenEstimate);

  const packed: PackedContextFile[] = [];
  let usedTokens = 0;
  for (const file of ranked) {
    if (file.tokenEstimate > tokenLimit) {
      continue;
    }
    if (usedTokens + file.tokenEstimate > tokenLimit) {
      continue;
    }
    packed.push(file);
    usedTokens += file.tokenEstimate;
  }

  return {
    tokenLimit,
    usedTokens,
    droppedFiles: ranked.length - packed.length,
    files: packed,
  };
}

export function createMockSourceFiles(): RepoSourceFile[] {
  return [
    {
      path: "src/api/controllers/user.controller.ts",
      absolutePath: "mock://acme-platform/src/api/controllers/user.controller.ts",
      type: "source",
      extension: "ts",
      relevanceScore: 95,
      tokenEstimate: 0,
      content: `import { UserService } from "../services/user.service";
import { validateUserInput } from "../validators/user.validator";

export class UserController {
  constructor(private readonly users = new UserService()) {}
  async update(input: unknown) {
    const safe = validateUserInput(input);
    return this.users.update(safe.id, safe.patch);
  }
}`,
    },
    {
      path: "src/api/services/user.service.ts",
      absolutePath: "mock://acme-platform/src/api/services/user.service.ts",
      type: "source",
      extension: "ts",
      relevanceScore: 88,
      tokenEstimate: 0,
      content: `export class UserService {
  async update(id: string, patch: Record<string, unknown>) {
    return { id, ...patch };
  }
}`,
    },
    {
      path: "src/api/validators/user.validator.ts",
      absolutePath: "mock://acme-platform/src/api/validators/user.validator.ts",
      type: "source",
      extension: "ts",
      relevanceScore: 84,
      tokenEstimate: 0,
      content: `export function validateUserInput(input: unknown) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid input");
  }
  return input as { id: string; patch: Record<string, unknown> };
}`,
    },
    {
      path: "README.md",
      absolutePath: "mock://acme-platform/README.md",
      type: "docs",
      extension: "md",
      relevanceScore: 45,
      tokenEstimate: 0,
      content: "# Acme Platform\n\nInternal API platform used for Oclushion context packing demos.",
    },
  ];
}

export async function loadRepositorySourceFiles(
  repo: RepoScanResult,
  maxFilesToRead = defaultMaxContextFilesToRead,
): Promise<RepoSourceFile[]> {
  if (repo.rootPath.startsWith("mock://")) {
    return createMockSourceFiles();
  }

  const candidates = selectContextCandidateFiles(repo.files, maxFilesToRead);
  const files: RepoSourceFile[] = [];
  for (const file of candidates) {
    try {
      const content = await readTextFile(file.absolutePath);
      files.push({
        path: file.path,
        absolutePath: file.absolutePath,
        type: file.type,
        extension: file.extension,
        relevanceScore: file.relevanceScore,
        tokenEstimate: estimateTokens(content),
        content,
      });
    } catch (error) {
      logger.debug('ContextService', `Skipping unreadable file: ${file.path}`, error);
    }
  }
  return files;
}

function selectContextCandidateFiles(files: FileScanResult[], limit: number): FileScanResult[] {
  return files
    .filter((file) => contextFileTypes.has(file.type))
    .sort((left, right) => right.relevanceScore - left.relevanceScore || left.size - right.size)
    .slice(0, Math.max(1, limit));
}

export class ContextService {
  public constructor(private readonly skillsInstaller: Pick<SkillsInstaller, "readInstalledContents">) {}

  public async buildMarketplaceSkillsContext(): Promise<string> {
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
}
