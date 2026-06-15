import { describe, expect, it, vi } from "vitest";

import { ToolsExecutor } from "./tools.executor";

describe("ToolsExecutor", () => {
  it("delegates to secureExecutor.runCommand with correct params", async () => {
    const runCommand = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    const executor = new ToolsExecutor({ runCommand } as never);

    await executor.executeInstalledTool(
      { binPath: "/tools/my-tool", id: "t1", name: "Tool", version: "1.0", installPath: "" } as never,
      ["--flag", "value"],
      "/project",
    );

    expect(runCommand).toHaveBeenCalledWith({
      command: "/tools/my-tool",
      args: ["--flag", "value"],
      cwd: "/project",
      requirePromptOverride: false,
    });
  });

  it("propagates errors from secureExecutor", async () => {
    const runCommand = vi.fn().mockRejectedValue(new Error("exec failed"));
    const executor = new ToolsExecutor({ runCommand } as never);

    await expect(
      executor.executeInstalledTool({ binPath: "/tools/x" } as never, [], "/p"),
    ).rejects.toThrow("exec failed");
  });
});
