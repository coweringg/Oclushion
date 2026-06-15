import { describe, expect, it } from "vitest";

import { PermissionManager } from "./permission.manager";

describe("PermissionManager", () => {
  it("requires prompts by default and auto-authorizes safe actions in God Mode", async () => {
    const manager = new PermissionManager();
    manager.setUserRole("owner");

    expect((await manager.shouldPromptUser("terminal_command", "pnpm test")).shouldPrompt).toBe(true);
    manager.enableGodMode("project-only");
    manager.enableGodMode("project-only");

    expect((await manager.shouldPromptUser("terminal_command", "pnpm test")).shouldPrompt).toBe(false);
    expect((await manager.shouldPromptUser("file_write", "src/app.ts")).shouldPrompt).toBe(false);
  });

  it("forces confirmation for destructive commands even in God Mode", async () => {
    const manager = new PermissionManager();
    manager.setUserRole("owner");
    manager.enableGodMode("unrestricted");

    expect((await manager.shouldPromptUser("terminal_command", "rm -rf /")).shouldPrompt).toBe(true);
    expect((await manager.shouldPromptUser("terminal_command", "drop database prod")).shouldPrompt).toBe(true);
  });
});
