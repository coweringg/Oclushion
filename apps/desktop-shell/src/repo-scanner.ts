import { join } from "@tauri-apps/api/path";
import { readDir, readTextFile, stat, type DirEntry } from "@tauri-apps/plugin-fs";
import { logger } from "./utils/logger";

export type FileScanType = "source" | "config" | "docs" | "test" | "infra" | "other";

export type FileScanResult = {
  path: string;
  absolutePath: string;
  type: FileScanType;
  size: number;
  extension: string;
  relevanceScore: number;
  lastModified: string;
  tokenEstimate: number;
};

export type RepoScanResult = {
  rootPath: string;
  totalFiles: number;
  filesByType: Record<string, number>;
  detectedFramework: string | null;
  detectedLanguage: string;
  hasTests: boolean;
  testRatio: number;
  hasDocumentation: boolean;
  isMonorepo: boolean;
  packages: string[];
  repoSummary: string;
  files: FileScanResult[];
};

export type FileTreeNode = {
  id: string;
  name: string;
  path: string;
  kind: "directory" | "file";
  type?: FileScanType;
  extension?: string;
  gitStatus?: "modified" | "added" | "deleted" | "renamed" | "untracked" | "unchanged";
  children?: FileTreeNode[];
};

const maxFiles = 100_000;
const maxFileSizeBytes = 500 * 1024;
const defaultIgnoredNames = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "target",
  ".venv",
  "venv",
  "__pycache__",
]);
const binaryExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "icns",
  "pdf",
  "zip",
  "tar",
  "gz",
  "7z",
  "rar",
  "mp4",
  "mov",
  "avi",
  "mp3",
  "wav",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "wasm",
  "exe",
  "dll",
  "dylib",
  "so",
]);
const sourceExtensions = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "go",
  "rs",
  "java",
  "kt",
  "cs",
  "php",
  "rb",
  "swift",
  "c",
  "cpp",
  "h",
  "hpp",
]);
const configExtensions = new Set(["json", "yaml", "yml", "toml", "ini", "env", "config"]);
const docsExtensions = new Set(["md", "mdx", "rst", "txt"]);
const infraNames = new Set([
  "dockerfile",
  "compose.yaml",
  "compose.yml",
  "docker-compose.yaml",
  "docker-compose.yml",
  "terraform.tf",
]);

export async function scanRepository(rootPath: string): Promise<RepoScanResult> {
  const ignoreRules = await readIgnoreRules(rootPath);
  const files: FileScanResult[] = [];
  await scanDirectory(rootPath, "", ignoreRules, files);

  const filesByType = files.reduce<Record<string, number>>((accumulator, file) => {
    accumulator[file.type] = (accumulator[file.type] ?? 0) + 1;
    return accumulator;
  }, {});
  const detectedLanguage = detectLanguage(files);
  const packages = detectPackages(files);
  const sourceCount = files.filter((file) => file.type === "source").length;
  const testCount = files.filter((file) => file.type === "test").length;
  const hasDocumentation = files.some((file) => file.type === "docs" || file.path.toLowerCase() === "readme.md");
  const framework = detectFramework(files);

  return {
    rootPath,
    totalFiles: files.length,
    filesByType,
    detectedFramework: framework,
    detectedLanguage,
    hasTests: testCount > 0,
    testRatio: sourceCount === 0 ? 0 : Number((testCount / sourceCount).toFixed(2)),
    hasDocumentation,
    isMonorepo: packages.length > 1 || files.some((file) => file.path.startsWith("apps/") || file.path.startsWith("packages/")),
    packages,
    repoSummary: createRepoSummary(files.length, detectedLanguage, framework, packages.length, testCount, hasDocumentation),
    files,
  };
}

export function buildFileTree(result: RepoScanResult): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  for (const file of result.files) {
    const parts = file.path.split("/");
    let current = root;
    parts.forEach((part, index) => {
      const partialPath = parts.slice(0, index + 1).join("/");
      const existing = current.find((node) => node.name === part);
      if (existing) {
        current = existing.children ?? current;
        return;
      }
      const isFile = index === parts.length - 1;
      const node: FileTreeNode = {
        id: partialPath,
        name: part,
        path: partialPath,
        kind: isFile ? "file" : "directory",
        type: isFile ? file.type : undefined,
        extension: isFile ? file.extension : undefined,
        children: isFile ? undefined : [],
      };
      current.push(node);
      current.sort(sortTreeNodes);
      current = node.children ?? current;
    });
  }
  return root;
}

export function createMockRepoScanResult(): RepoScanResult {
  const now = new Date().toISOString();
  const files: FileScanResult[] = [
    mockFile("src/api/controllers/user.controller.ts", "source", 4200, now),
    mockFile("src/api/services/auth.service.ts", "source", 3600, now),
    mockFile("src/api/routes.ts", "source", 2800, now),
    mockFile("src/lib/repo-graph.ts", "source", 5100, now),
    mockFile("src/lib/repo-graph.test.ts", "test", 1800, now),
    mockFile("docs/architecture.md", "docs", 2200, now),
    mockFile("package.json", "config", 980, now),
    mockFile("tsconfig.json", "config", 640, now),
    mockFile("Dockerfile", "infra", 720, now),
    mockFile("README.md", "docs", 1500, now),
  ];
  return {
    rootPath: "mock://acme-platform",
    totalFiles: files.length,
    filesByType: { source: 4, test: 1, docs: 2, config: 2, infra: 1 },
    detectedFramework: "Vite",
    detectedLanguage: "TypeScript",
    hasTests: true,
    testRatio: 0.25,
    hasDocumentation: true,
    isMonorepo: false,
    packages: ["acme-platform"],
    repoSummary: "Mock TypeScript project with Vite, tests, documentation and Oclushion-ready context metadata.",
    files,
  };
}

async function scanDirectory(
  rootPath: string,
  relativePath: string,
  ignoreRules: string[],
  files: FileScanResult[],
): Promise<void> {
  if (files.length >= maxFiles) {
    return;
  }

  const absoluteDir = relativePath ? await join(rootPath, relativePath) : rootPath;
  let entries: DirEntry[] = [];
  try {
    entries = await readDir(absoluteDir);
  } catch (error) {
    logger.debug('RepoScanner', `Failed to read directory: ${absoluteDir}`, error);
    return;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (files.length >= maxFiles || shouldIgnoreEntry(entry.name, relativePath, ignoreRules)) {
      continue;
    }

    const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const absolutePath = await join(rootPath, entryRelativePath);
    if (entry.isDirectory) {
      await scanDirectory(rootPath, entryRelativePath, ignoreRules, files);
      continue;
    }
    if (!entry.isFile) {
      continue;
    }

    const extension = getExtension(entry.name);
    if (entry.name.endsWith(".lock") || binaryExtensions.has(extension)) {
      continue;
    }

    let info;
    try {
      info = await stat(absolutePath);
    } catch (error) {
      logger.debug('RepoScanner', `Failed to stat file: ${absolutePath}`, error);
      continue;
    }
    if (info.size > maxFileSizeBytes) {
      continue;
    }

    const type = classifyFile(entry.name, extension, entryRelativePath);
    files.push({
      path: entryRelativePath.replaceAll("\\", "/"),
      absolutePath,
      type,
      size: info.size,
      extension,
      relevanceScore: scoreFile(entryRelativePath, type, info.size),
      lastModified: info.mtime?.toISOString() ?? new Date().toISOString(),
      tokenEstimate: Math.ceil(info.size / 4),
    });
  }
}

async function readIgnoreRules(rootPath: string): Promise<string[]> {
  const files = [".gitignore", ".oclushionignore"];
  const rules: string[] = [];
  for (const file of files) {
    try {
      const content = await readTextFile(await join(rootPath, file));
      rules.push(
        ...content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#")),
      );
    } catch (error) {
      logger.debug('RepoScanner', `Ignore file not found: ${file}`, error);
    }
  }
  return rules;
}

function shouldIgnoreEntry(name: string, parentPath: string, ignoreRules: string[]): boolean {
  const normalizedPath = parentPath ? `${parentPath}/${name}` : name;
  const lowerName = name.toLowerCase();
  if (defaultIgnoredNames.has(lowerName)) {
    return true;
  }
  return ignoreRules.some((rule) => matchesIgnoreRule(rule, normalizedPath, name));
}

function matchesIgnoreRule(rule: string, path: string, name: string): boolean {
  const normalizedRule = rule.replaceAll("\\", "/").replace(/^\//, "").replace(/\/$/, "");
  if (!normalizedRule) {
    return false;
  }
  if (normalizedRule.includes("*")) {
    const regex = new RegExp(`^${escapeRegex(normalizedRule).replaceAll("\\*", ".*")}$`);
    return regex.test(path) || regex.test(name);
  }
  return path === normalizedRule || path.startsWith(`${normalizedRule}/`) || name === normalizedRule;
}

function classifyFile(name: string, extension: string, path: string): FileScanType {
  const lowerName = name.toLowerCase();
  const lowerPath = path.toLowerCase();
  if (lowerName.includes(".test.") || lowerName.includes(".spec.") || lowerPath.includes("__tests__/")) {
    return "test";
  }
  if (infraNames.has(lowerName) || lowerPath.includes("k8s/") || lowerPath.includes("terraform/")) {
    return "infra";
  }
  if (docsExtensions.has(extension)) {
    return "docs";
  }
  if (configExtensions.has(extension) || lowerName.startsWith(".env")) {
    return "config";
  }
  if (sourceExtensions.has(extension)) {
    return "source";
  }
  return "other";
}

function scoreFile(path: string, type: FileScanType, size: number): number {
  let score = 20;
  if (["package.json", "tsconfig.json", "vite.config.ts", "next.config.ts"].includes(path.toLowerCase())) score += 20;
  if (!path.includes("/")) score += 10;
  if (type === "test") score += 15;
  if (type === "config") score += 20;
  if (size < 5_000) score += 5;
  return Math.min(score, 100);
}

function detectLanguage(files: FileScanResult[]): string {
  const counts = files.reduce<Record<string, number>>((accumulator, file) => {
    if (file.type === "source") {
      accumulator[file.extension] = (accumulator[file.extension] ?? 0) + 1;
    }
    return accumulator;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const names: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    py: "Python",
    rs: "Rust",
    go: "Go",
    java: "Java",
  };
  return top ? names[top] ?? top.toUpperCase() : "Unknown";
}

function detectFramework(files: FileScanResult[]): string | null {
  const paths = new Set(files.map((file) => file.path.toLowerCase()));
  if ([...paths].some((path) => path.startsWith("next.config."))) return "Next.js";
  if ([...paths].some((path) => path.startsWith("vite.config."))) return "Vite";
  if (paths.has("src-tauri/tauri.conf.json")) return "Tauri";
  if (paths.has("cargo.toml")) return "Rust/Cargo";
  if (paths.has("requirements.txt") || paths.has("pyproject.toml")) return "Python";
  return null;
}

function detectPackages(files: FileScanResult[]): string[] {
  return files
    .filter((file) => file.path === "package.json" || file.path.endsWith("/package.json"))
    .map((file) => file.path.replace(/\/?package\.json$/, "") || "root")
    .slice(0, 100);
}

function createRepoSummary(
  totalFiles: number,
  language: string,
  framework: string | null,
  packageCount: number,
  testCount: number,
  hasDocumentation: boolean,
): string {
  return `${language} repository with ${totalFiles} indexed files${framework ? `, ${framework} detected` : ""}, ${packageCount} package manifest(s), ${testCount} test file(s), and ${hasDocumentation ? "documentation present" : "no documentation detected"}.`;
}

function mockFile(path: string, type: FileScanType, size: number, lastModified: string): FileScanResult {
  return {
    path,
    absolutePath: `mock://acme-platform/${path}`,
    type,
    size,
    extension: getExtension(path),
    relevanceScore: scoreFile(path, type, size),
    lastModified,
    tokenEstimate: Math.ceil(size / 4),
  };
}

function getExtension(name: string): string {
  const last = name.split(".").pop();
  return last && last !== name ? last.toLowerCase() : "";
}

function sortTreeNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.kind !== b.kind) {
    return a.kind === "directory" ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function escapeRegex(input: string): string {
  return input.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}
