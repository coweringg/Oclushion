import type { FileApplyStatus } from "./fast-apply.types";

export class FileStatusMap {
  private readonly statuses = new Map<string, FileApplyStatus>();

  public set(path: string, status: FileApplyStatus): void {
    this.statuses.set(normalizePath(path), status);
  }

  public get(path: string): FileApplyStatus {
    return this.statuses.get(normalizePath(path)) ?? "clean";
  }

  public clear(path: string): void {
    this.statuses.delete(normalizePath(path));
  }

  public entries(): Array<{ path: string; status: FileApplyStatus }> {
    return [...this.statuses.entries()].map(([path, status]) => ({ path, status }));
  }

  public pending(): string[] {
    return this.entries().filter((entry) => entry.status === "pending-review").map((entry) => entry.path);
  }
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}
