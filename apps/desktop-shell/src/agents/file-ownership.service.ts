import type { AgentRole } from "./types";

export type FileOwnershipRecord = {
  path: string;
  agentRole: AgentRole;
  sessionId: string;
  acquiredAt: string;
  releasedAt?: string;
};

const neverTouchPatterns = [
  /^\.env/u,
  /(^|\/)secrets\//u,
  /(^|\/)migrations\/.*\.sql$/u,
  /tauri\.conf\.json$/u,
  /Cargo\.toml$/u,
  /pnpm-workspace\.yaml$/u,
];

export class FileOwnershipService {
  private readonly locks = new Map<string, FileOwnershipRecord>();

  public acquire(paths: string[], agentRole: AgentRole, sessionId: string): boolean {
    if (paths.some((path) => this.isProtected(path))) {
      return false;
    }
    if (paths.some((path) => !this.isAvailable(path, agentRole))) {
      return false;
    }
    const acquiredAt = new Date().toISOString();
    paths.forEach((path) => {
      this.locks.set(path, { path, agentRole, sessionId, acquiredAt });
    });
    return true;
  }

  public release(agentRole: AgentRole, sessionId: string): void {
    for (const [path, record] of this.locks) {
      if (record.agentRole === agentRole && record.sessionId === sessionId) {
        this.locks.delete(path);
      }
    }
  }

  public releaseSession(sessionId: string): void {
    for (const [path, record] of this.locks) {
      if (record.sessionId === sessionId) {
        this.locks.delete(path);
      }
    }
  }

  public isAvailable(path: string, agentRole: AgentRole): boolean {
    if (this.isProtected(path)) {
      return false;
    }
    const existing = this.locks.get(path);
    return !existing || existing.agentRole === agentRole;
  }

  public isProtected(path: string): boolean {
    const normalized = path.replaceAll("\\", "/");
    return neverTouchPatterns.some((pattern) => pattern.test(normalized));
  }

  public getSnapshot(): FileOwnershipRecord[] {
    return [...this.locks.values()];
  }
}
