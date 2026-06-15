import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import type { AgentRole } from "../agents/types";
import { FileStatusMap } from "./file-status.map";
import type {
  FastApplyAuditSink,
  FastApplyFileSystem,
  FastApplySession,
  FileApplyStatus,
  FileSnapshot,
} from "./fast-apply.types";

const tauriFileSystem: FastApplyFileSystem = {
  readTextFile,
  writeTextFile,
};

export class FastApplyService {
  private readonly sessions = new Map<string, FastApplySession>();
  private readonly fileStatuses = new FileStatusMap();

  public constructor(
    private readonly fileSystem: FastApplyFileSystem = tauriFileSystem,
    private readonly auditSink: FastApplyAuditSink = () => undefined,
    private readonly workspaceRootProvider: () => string | null = () => null,
  ) {}

  public async applyChange(input: {
    path: string;
    newContent: string;
    taskId: string;
    agentRole: AgentRole;
    sessionId?: string;
  }): Promise<FastApplySession> {
    const resolvedPath = this.resolveWritablePath(input.path);
    const originalContent = await this.fileSystem.readTextFile(resolvedPath).catch((error: unknown) => {
      throw new Error(`Fast Apply could not read ${resolvedPath}: ${formatError(error)}`);
    });
    const { linesAdded, linesRemoved } = diffLineCounts(originalContent, input.newContent);
    const snapshot: FileSnapshot = {
      path: resolvedPath,
      originalContent,
      newContent: input.newContent,
      taskId: input.taskId,
      agentRole: input.agentRole,
      appliedAt: new Date().toISOString(),
      status: "pending-review",
      linesAdded,
      linesRemoved,
    };

    await this.fileSystem.writeTextFile(resolvedPath, input.newContent);
    const session = this.upsertSession(input.sessionId ?? createSessionId(input.taskId), input.taskId, snapshot);
    this.fileStatuses.set(resolvedPath, "pending-review");
    this.auditSink({
      type: "FAST_APPLY_WRITTEN",
      path: resolvedPath,
      taskId: input.taskId,
      agentRole: input.agentRole,
      linesAdded,
      linesRemoved,
    });
    return session;
  }

  public async acceptFile(path: string, sessionId: string): Promise<FastApplySession> {
    return this.resolveFile(path, sessionId, "accepted");
  }

  public async revertFile(path: string, sessionId: string): Promise<FastApplySession> {
    const session = this.requireSession(sessionId);
    const snapshot = this.requireSnapshot(session, path);
    await this.fileSystem.writeTextFile(snapshot.path, snapshot.originalContent);
    this.auditSink({
      type: "CODE_REVERTED",
      path: snapshot.path,
      taskId: snapshot.taskId,
      agentRole: snapshot.agentRole,
      restoredFromSnapshot: true,
    });
    return this.resolveFile(path, sessionId, "reverted", false);
  }

  public async acceptAll(sessionId: string): Promise<FastApplySession> {
    const session = this.requireSession(sessionId);
    for (const snapshot of session.snapshots.filter((candidate) => candidate.status === "pending-review")) {
      await this.acceptFile(snapshot.path, sessionId);
    }
    return this.requireSession(sessionId);
  }

  public async revertAll(sessionId: string): Promise<FastApplySession> {
    const session = this.requireSession(sessionId);
    for (const snapshot of session.snapshots.filter((candidate) => candidate.status === "pending-review")) {
      await this.revertFile(snapshot.path, sessionId);
    }
    return this.requireSession(sessionId);
  }

  public getPendingFiles(sessionId?: string): FileSnapshot[] {
    if (sessionId) {
      return this.requireSession(sessionId).snapshots.filter((snapshot) => snapshot.status === "pending-review");
    }
    return [...this.sessions.values()].flatMap((session) =>
      session.snapshots.filter((snapshot) => snapshot.status === "pending-review"),
    );
  }

  public getSessions(): FastApplySession[] {
    return [...this.sessions.values()].map(cloneSession);
  }

  public getFileStatus(path: string): FileApplyStatus {
    return this.fileStatuses.get(path);
  }

  private async resolveFile(
    path: string,
    sessionId: string,
    status: "accepted" | "reverted",
    emitAudit = true,
  ): Promise<FastApplySession> {
    const session = this.requireSession(sessionId);
    const snapshot = this.requireSnapshot(session, path);
    snapshot.status = status;
    this.fileStatuses.set(snapshot.path, status);
    if (status === "accepted" && emitAudit) {
      this.auditSink({
        type: "CODE_ACCEPTED",
        path: snapshot.path,
        taskId: snapshot.taskId,
        agentRole: snapshot.agentRole,
        linesAdded: snapshot.linesAdded,
        linesRemoved: snapshot.linesRemoved,
      });
    }
    session.status = deriveSessionStatus(session);
    if (session.status !== "pending") {
      session.resolvedAt = new Date().toISOString();
    }
    return cloneSession(session);
  }

  private upsertSession(sessionId: string, taskId: string, snapshot: FileSnapshot): FastApplySession {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      const session: FastApplySession = {
        id: sessionId,
        taskId,
        snapshots: [snapshot],
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      this.sessions.set(sessionId, session);
      return cloneSession(session);
    }
    existing.snapshots = [
      snapshot,
      ...existing.snapshots.filter((candidate) => candidate.path !== snapshot.path),
    ];
    existing.status = "pending";
    existing.resolvedAt = undefined;
    return cloneSession(existing);
  }

  private requireSession(sessionId: string): FastApplySession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Fast Apply session not found: ${sessionId}`);
    }
    return session;
  }

  private requireSnapshot(session: FastApplySession, path: string): FileSnapshot {
    const normalizedPath = this.resolveKnownPath(path);
    const snapshot = session.snapshots.find((candidate) => candidate.path === normalizedPath);
    if (!snapshot) {
      throw new Error(`Fast Apply snapshot not found for ${normalizedPath}`);
    }
    return snapshot;
  }

  private resolveWritablePath(path: string): string {
    const workspaceRoot = this.resolveWorkspaceRoot();
    const resolvedPath = resolvePathWithinWorkspace(workspaceRoot, path);
    assertWritablePath(resolvedPath);
    return resolvedPath;
  }

  private resolveKnownPath(path: string): string {
    const workspaceRoot = this.resolveWorkspaceRoot();
    return resolvePathWithinWorkspace(workspaceRoot, path);
  }

  private resolveWorkspaceRoot(): string {
    const workspaceRoot = this.workspaceRootProvider();
    if (!workspaceRoot || workspaceRoot.startsWith("mock://")) {
      throw new Error("Fast Apply requires an opened local workspace before writing to disk.");
    }
    return normalizePath(workspaceRoot);
  }
}

function assertWritablePath(path: string): void {
  if (/(^|\/)\.env($|[./])|(^|\/)secrets\/|(^|\/)\.git\//u.test(path)) {
    throw new Error(`Fast Apply refused to write protected path: ${path}`);
  }
}

function resolvePathWithinWorkspace(workspaceRoot: string, candidatePath: string): string {
  const root = normalizeAndResolvePath(workspaceRoot);
  const candidate = isAbsolutePath(candidatePath)
    ? normalizeAndResolvePath(candidatePath)
    : normalizeAndResolvePath(`${root}/${candidatePath}`);
  const comparableRoot = comparablePath(root);
  const comparableCandidate = comparablePath(candidate);
  if (comparableCandidate !== comparableRoot && !comparableCandidate.startsWith(`${comparableRoot}/`)) {
    throw new Error(`Fast Apply rejected path outside workspace: ${candidate}`);
  }
  return candidate;
}

function normalizeAndResolvePath(path: string): string {
  const normalized = normalizePath(path);
  const prefix = normalized.match(/^[A-Za-z]:/u)?.[0] ?? (normalized.startsWith("/") ? "/" : "");
  const rest = prefix === "/" ? normalized.slice(1) : prefix ? normalized.slice(prefix.length).replace(/^\/+/u, "") : normalized;
  const parts: string[] = [];
  for (const part of rest.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  if (prefix === "/") {
    return `/${parts.join("/")}`;
  }
  if (prefix) {
    return `${prefix}/${parts.join("/")}`;
  }
  return parts.join("/");
}

function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/u.test(path) || path.startsWith("/") || path.startsWith("\\\\");
}

function comparablePath(path: string): string {
  return /^[A-Za-z]:/u.test(path) ? path.toLowerCase() : path;
}

function createSessionId(taskId: string): string {
  return `fast-apply-${taskId}-${Date.now()}`;
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function diffLineCounts(originalContent: string, newContent: string): { linesAdded: number; linesRemoved: number } {
  const originalLines = originalContent.split("\n");
  const newLines = newContent.split("\n");
  const max = Math.max(originalLines.length, newLines.length);
  let linesAdded = 0;
  let linesRemoved = 0;
  for (let index = 0; index < max; index += 1) {
    if (originalLines[index] !== newLines[index]) {
      if (newLines[index] !== undefined) linesAdded += 1;
      if (originalLines[index] !== undefined) linesRemoved += 1;
    }
  }
  return { linesAdded, linesRemoved };
}

function deriveSessionStatus(session: FastApplySession): FastApplySession["status"] {
  const statuses = session.snapshots.map((snapshot) => snapshot.status);
  if (statuses.every((status) => status === "accepted")) return "fully-accepted";
  if (statuses.every((status) => status === "reverted")) return "fully-reverted";
  if (statuses.some((status) => status === "pending-review")) return "pending";
  return "partially-resolved";
}

function cloneSession(session: FastApplySession): FastApplySession {
  return {
    ...session,
    snapshots: session.snapshots.map((snapshot) => ({ ...snapshot })),
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
