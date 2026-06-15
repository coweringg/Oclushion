import { describe, expect, it } from "vitest";

import { FastApplyService } from "./fast-apply.service";
import type { FastApplyFileSystem } from "./fast-apply.types";

class MemoryFs implements FastApplyFileSystem {
  public readonly files = new Map<string, string>();

  public async readTextFile(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error("missing file");
    return value;
  }

  public async writeTextFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}

describe("FastApplyService", () => {
  it("writes physical changes inside the workspace, keeps RAM snapshots and reverts instantly", async () => {
    const fs = new MemoryFs();
    fs.files.set("C:/repo/src/auth.ts", "export const auth = false;\n");
    const audit: string[] = [];
    const service = new FastApplyService(fs, (event) => audit.push(event.type), () => "C:/repo");

    const session = await service.applyChange({
      path: "src/auth.ts",
      newContent: "export const auth = true;\n",
      taskId: "task-1",
      agentRole: "builder",
    });

    expect(fs.files.get("C:/repo/src/auth.ts")).toBe("export const auth = true;\n");
    expect(service.getPendingFiles(session.id)).toHaveLength(1);
    expect(service.getFileStatus("C:/repo/src/auth.ts")).toBe("pending-review");

    await service.revertFile("src/auth.ts", session.id);

    expect(fs.files.get("C:/repo/src/auth.ts")).toBe("export const auth = false;\n");
    expect(service.getFileStatus("C:/repo/src/auth.ts")).toBe("reverted");
    expect(audit).toEqual(["FAST_APPLY_WRITTEN", "CODE_REVERTED"]);
  });

  it("accepts applied files and refuses protected paths", async () => {
    const fs = new MemoryFs();
    fs.files.set("C:/repo/src/button.tsx", "old");
    const service = new FastApplyService(fs, undefined, () => "C:/repo");

    const session = await service.applyChange({
      path: "src/button.tsx",
      newContent: "new",
      taskId: "task-2",
      agentRole: "builder",
    });
    await service.acceptFile("src/button.tsx", session.id);

    expect(service.getSessions()[0]?.status).toBe("fully-accepted");
    await expect(
      service.applyChange({
        path: ".env",
        newContent: "SECRET=nope",
        taskId: "task-3",
        agentRole: "builder",
      }),
    ).rejects.toThrow(/protected path/u);
  });

  it("rejects traversal and absolute paths outside the active workspace", async () => {
    const fs = new MemoryFs();
    fs.files.set("C:/repo/src/allowed.ts", "old");
    const service = new FastApplyService(fs, undefined, () => "C:/repo");

    await expect(
      service.applyChange({
        path: "../outside.ts",
        newContent: "bad",
        taskId: "task-4",
        agentRole: "builder",
      }),
    ).rejects.toThrow(/outside workspace/u);

    await expect(
      service.applyChange({
        path: "C:/Windows/System32/drivers/etc/hosts",
        newContent: "bad",
        taskId: "task-5",
        agentRole: "builder",
      }),
    ).rejects.toThrow(/outside workspace/u);

    await service.applyChange({
      path: "C:/repo/src/allowed.ts",
      newContent: "new",
      taskId: "task-6",
      agentRole: "builder",
    });

    expect(fs.files.get("C:/repo/src/allowed.ts")).toBe("new");
  });

  it("requires an opened local workspace before writing", async () => {
    const service = new FastApplyService(new MemoryFs(), undefined, () => null);

    await expect(
      service.applyChange({
        path: "src/nope.ts",
        newContent: "bad",
        taskId: "task-7",
        agentRole: "builder",
      }),
    ).rejects.toThrow(/opened local workspace/u);
  });
});
