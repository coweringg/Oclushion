import { describe, expect, it, vi } from "vitest";

vi.mock("../crypto/hmac", () => ({
  computeHmacSync: vi.fn(() => "a".repeat(64)),
}));

import { SanoShield } from "../sano-shield.service";
import { TerminalService, type TerminalBridge } from "./terminal.service";
import type { TerminalDataEvent, TerminalExitEvent } from "./terminal.types";

describe("TerminalService", () => {
  it("keeps user and agent terminals isolated and sanitizes terminal output", async () => {
    const bridge = createBridge();
    const service = new TerminalService(new SanoShield(), undefined, bridge);
    await service.start();

    const user = await service.spawnUserTerminal("C:/repo");
    const agent = await service.getOrCreateAgentTerminal("C:/repo");

    await service.writeToUserTerminal(user.id, "git status\r");
    expect(bridge.userWrites).toEqual([{ sessionId: user.id, data: "git status\r" }]);
    await expect(service.writeToUserTerminal(agent.id, "echo nope\r")).rejects.toThrow(/read-only/u);

    bridge.emitData({ sessionId: agent.id, data: "echo admin@company.com\n" });
    expect(service.getAgentScrollback()).not.toContain("echo admin@company.com");
    expect(service.getAgentScrollback().join("\n")).toMatch(/⟨PII:EMAIL/);
  });

  it("runs agent commands in the fixed agent terminal and resolves on exit", async () => {
    const bridge = createBridge();
    const service = new TerminalService(new SanoShield(), undefined, bridge);
    await service.start();
    const pending = service.runAgentCommand("pnpm", ["test"], "C:/repo", { requirePromptOverride: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bridge.agentRuns[0]).toMatchObject({ command: "pnpm", args: ["test"] });
    const agent = service.getAgentSession();
    expect(agent?.owner).toBe("agent");
    bridge.emitExit({ sessionId: agent!.id, code: 0 });
    await expect(pending).resolves.toMatchObject({ exitCode: 0 });
  });
});

function createBridge() {
  let counter = 0;
  const dataListeners = new Set<(event: TerminalDataEvent) => void>();
  const exitListeners = new Set<(event: TerminalExitEvent) => void>();
  const bridge: TerminalBridge & {
    userWrites: Array<{ sessionId: string; data: string }>;
    agentRuns: Array<{ sessionId: string; command: string; args: string[]; cwd?: string }>;
    emitData(event: TerminalDataEvent): void;
    emitExit(event: TerminalExitEvent): void;
  } = {
    userWrites: [],
    agentRuns: [],
    spawnUser: async () => ({ sessionId: `user-${++counter}`, pid: counter }),
    spawnAgent: async () => ({ sessionId: `agent-${++counter}` }),
    runAgentCommand: async (sessionId, command, args, cwd) => {
      bridge.agentRuns.push({ sessionId, command, args, cwd });
    },
    write: async (sessionId, data) => {
      bridge.userWrites.push({ sessionId, data });
    },
    kill: async () => undefined,
    resize: async () => undefined,
    onData: async (listener) => {
      dataListeners.add(listener);
      return () => dataListeners.delete(listener);
    },
    onExit: async (listener) => {
      exitListeners.add(listener);
      return () => exitListeners.delete(listener);
    },
    emitData: (event) => dataListeners.forEach((listener) => listener(event)),
    emitExit: (event) => exitListeners.forEach((listener) => listener(event)),
  };
  return bridge;
}
