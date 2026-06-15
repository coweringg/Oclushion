import { describe, expect, it, vi } from "vitest";

import { SecureExecutor } from "./secure-executor";

vi.mock("@tauri-apps/plugin-shell", () => ({
  Command: {
    create: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue({ code: 0, stdout: "output", stderr: "" }),
    }),
  },
}));

function createMockPermissions(shouldPrompt = false) {
  return {
    shouldPromptUser: vi.fn().mockResolvedValue({ shouldPrompt, reason: shouldPrompt ? "needs approval" : "", effect: "BLOCK" }),
  };
}

function createMockShield() {
  return {
    sanitize: vi.fn().mockReturnValue({ sanitizedText: "sanitized", mappings: [] }),
  };
}

describe("SecureExecutor", () => {
  it("executes command and returns result", async () => {
    const permissions = createMockPermissions(false);
    const shield = createMockShield();
    const auditSink = vi.fn();
    const executor = new SecureExecutor(permissions as never, shield as never, auditSink);

    const result = await executor.runCommand({ command: "ls", args: ["-la"] });

    expect(result.command).toBe("ls");
    expect(result.args).toEqual(["-la"]);
    expect(result.exitCode).toBe(0);
    expect(result.autoExecuted).toBe(true);
  });

  it("sanitizes stdout and stderr through SanoShield", async () => {
    const shield = createMockShield();
    const executor = new SecureExecutor(createMockPermissions() as never, shield as never);
    await executor.runCommand({ command: "echo" });
    expect(shield.sanitize).toHaveBeenCalled();
  });

  it("throws when command requires confirmation and requirePromptOverride is false", async () => {
    const permissions = createMockPermissions(true);
    const executor = new SecureExecutor(permissions as never, createMockShield() as never);

    await expect(
      executor.runCommand({ command: "rm", args: ["-rf", "/"], requirePromptOverride: false }),
    ).rejects.toThrow("requires explicit confirmation");
  });

  it("allows command when requirePromptOverride is true even if shouldPrompt", async () => {
    const permissions = createMockPermissions(true);
    const executor = new SecureExecutor(permissions as never, createMockShield() as never);

    const result = await executor.runCommand({ command: "ls", requirePromptOverride: true });
    expect(result.autoExecuted).toBe(false);
  });

  it("sends audit event after execution", async () => {
    const auditSink = vi.fn();
    const executor = new SecureExecutor(createMockPermissions() as never, createMockShield() as never, auditSink);
    await executor.runCommand({ command: "pwd" });

    expect(auditSink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "COMMAND_EXECUTED", summary: expect.stringContaining("pwd") }),
    );
  });

  it("shouldPrompt delegates to permissions", async () => {
    const permissions = createMockPermissions(true);
    const executor = new SecureExecutor(permissions as never, createMockShield() as never);
    expect(await executor.shouldPrompt("terminal_command", "rm -rf /")).toBe(true);
  });
});
