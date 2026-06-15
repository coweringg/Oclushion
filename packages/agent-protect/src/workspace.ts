import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defaultWorkspacePolicy } from "./policy.js";
import { classifyFile, restoreTokens, sanitizeContent, shouldIgnoreDirectory } from "./scanner.js";
import { loadManifest, saveManifest } from "./store.js";
import type { AgentSessionManifest, AgentWorkspacePolicy, WorkspaceFileRecord } from "./types.js";
import { recordAgentAuditEvent } from "./audit.js";

export async function createProtectedWorkspace(input: {
  projectPath: string;
  policy?: Partial<AgentWorkspacePolicy>;
}) {
  const projectPath = path.resolve(input.projectPath);
  const policy = { ...defaultWorkspacePolicy, ...input.policy };
  const sessionId = randomUUID();
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), `sano-agent-${sessionId}-`));
  const files: WorkspaceFileRecord[] = [];
  const mappings: AgentSessionManifest["mappings"] = [];

  await walkProject(projectPath, async (absolutePath, relativePath) => {
    const fileStat = await stat(absolutePath);
    const classification = classifyFile(relativePath, fileStat.size, policy);
    const workspaceFilePath = path.join(workspacePath, relativePath);

    if (classification.blocked) {
      files.push({
        relativePath,
        sourcePath: absolutePath,
        workspacePath: workspaceFilePath,
        status: "blocked",
        contentKind: "blocked",
        bytes: fileStat.size,
        tokens: [],
        reason: classification.reason,
      });
      return;
    }

    await mkdir(path.dirname(workspaceFilePath), { recursive: true });
    if (isTextLike(relativePath)) {
      const content = await readFile(absolutePath, "utf8");
      const sanitized = sanitizeContent(relativePath, content);
      await writeFile(workspaceFilePath, sanitized.sanitized, "utf8");
      mappings.push(...sanitized.mappings);
      files.push({
        relativePath,
        sourcePath: absolutePath,
        workspacePath: workspaceFilePath,
        status: sanitized.mappings.length > 0 ? "sanitized" : "copied",
        contentKind: "text",
        bytes: fileStat.size,
        tokens: sanitized.mappings.map((mapping) => mapping.token),
      });
      return;
    }

    await copyFile(absolutePath, workspaceFilePath);
    files.push({
      relativePath,
      sourcePath: absolutePath,
      workspacePath: workspaceFilePath,
      status: "copied",
      contentKind: "binary",
      bytes: fileStat.size,
      tokens: [],
    });
  }, policy);

  const manifest: AgentSessionManifest = {
    id: sessionId,
    projectPath,
    workspacePath,
    createdAt: new Date().toISOString(),
    policy,
    files,
    mappings,
  };
  await writePublicWorkspaceMetadata(manifest);
  await saveManifest(manifest);
  return manifest;
}

export async function summarizeSession(sessionId: string) {
  const manifest = await loadManifest(sessionId);
  return {
    id: manifest.id,
    projectPath: manifest.projectPath,
    workspacePath: manifest.workspacePath,
    copied: manifest.files.filter((file) => file.status === "copied").length,
    sanitized: manifest.files.filter((file) => file.status === "sanitized").length,
    blocked: manifest.files.filter((file) => file.status === "blocked").length,
    tokens: manifest.mappings.length,
  };
}

export async function diffSession(sessionId: string) {
  const manifest = await loadManifest(sessionId);
  const changed: string[] = [];

  for (const file of manifest.files.filter((entry) => entry.status !== "blocked")) {
    try {
      if (file.contentKind === "binary") {
        const [workspaceContent, originalContent] = await Promise.all([
          readFile(file.workspacePath),
          readFile(file.sourcePath),
        ]);
        if (!workspaceContent.equals(originalContent)) {
          changed.push(file.relativePath);
        }
        continue;
      }
      const workspaceContent = await readFile(file.workspacePath, "utf8");
      const originalContent = await readFile(file.sourcePath, "utf8");
      const restored = restoreTokens(
        workspaceContent,
        manifest.mappings.filter((mapping) => mapping.relativePath === file.relativePath),
      );
      if (restored !== originalContent) {
        changed.push(file.relativePath);
      }
    } catch {
      changed.push(file.relativePath);
    }
  }

  return { sessionId, changed };
}

export async function applySession(sessionId: string) {
  const manifest = await loadManifest(sessionId);
  const diff = await diffSession(sessionId);

  for (const relativePath of diff.changed) {
    const file = manifest.files.find((entry) => entry.relativePath === relativePath);
    if (!file || file.status === "blocked") {
      continue;
    }
    if (file.contentKind === "binary") {
      await mkdir(path.dirname(file.sourcePath), { recursive: true });
      await copyFile(file.workspacePath, file.sourcePath);
      continue;
    }
    const workspaceContent = await readFile(file.workspacePath, "utf8");
    const restored = restoreTokens(
      workspaceContent,
      manifest.mappings.filter((mapping) => mapping.relativePath === relativePath),
    );
    await mkdir(path.dirname(file.sourcePath), { recursive: true });
    await writeFile(file.sourcePath, restored, "utf8");
  }

  await recordAgentAuditEvent({
    sessionId,
    module: "agent-protect",
    action: "workspace_apply",
    decision: "ALLOW",
    status: "allowed",
    metadata: { changedFiles: diff.changed.length },
  });

  return { sessionId, applied: diff.changed };
}

async function walkProject(
  root: string,
  visit: (absolutePath: string, relativePath: string) => Promise<void>,
  policy: AgentWorkspacePolicy,
  current = root,
) {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && shouldIgnoreDirectory(entry.name, policy)) {
      continue;
    }
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walkProject(root, visit, policy, absolutePath);
      continue;
    }
    if (entry.isFile()) {
      await visit(absolutePath, path.relative(root, absolutePath));
    }
  }
}

function isTextLike(relativePath: string) {
  const extension = path.extname(relativePath).toLowerCase();
  return (
    extension === "" ||
    [
      ".cjs",
      ".css",
      ".env",
      ".html",
      ".js",
      ".json",
      ".jsx",
      ".md",
      ".mjs",
      ".py",
      ".ts",
      ".tsx",
      ".txt",
      ".yaml",
      ".yml",
    ].includes(extension)
  );
}

async function writePublicWorkspaceMetadata(manifest: AgentSessionManifest) {
  await writeFile(
    path.join(manifest.workspacePath, ".sano-agent.json"),
    JSON.stringify(
      {
        sessionId: manifest.id,
        projectPath: manifest.projectPath,
        createdAt: manifest.createdAt,
        note: "Secret mappings are intentionally stored outside this workspace.",
      },
      null,
      2,
    ),
    "utf8",
  );
}
