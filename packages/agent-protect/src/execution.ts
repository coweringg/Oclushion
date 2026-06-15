import { spawn } from "node:child_process";

import { recordAgentAuditEvent, hashCommand } from "./audit.js";
import {
  evaluateCommand,
  evaluateNetworkTarget,
  evaluateToolInvocation,
  hostFromTarget,
} from "./execution-policy.js";
import { loadManifest } from "./store.js";
import type { AgentExecutionDecision } from "./types.js";

export type AgentExecResult = {
  decision: AgentExecutionDecision;
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export async function runMediatedCommand(input: {
  sessionId: string;
  command: string;
  args: string[];
}) {
  const manifest = await loadManifest(input.sessionId);
  const decision = evaluateCommand(input.command, input.args, manifest.policy);
  const commandHash = hashCommand(input.command, input.args);
  const executable = input.command.split(/[\\/]/).pop() ?? input.command;

  if (decision.effect !== "ALLOW") {
    await recordAgentAuditEvent({
      sessionId: input.sessionId,
      module: "agent-protect",
      action: "command_exec",
      decision: decision.effect,
      status: decision.effect === "BLOCK" ? "blocked" : "pending_approval",
      commandHash,
      executable,
      exitCode: null,
      metadata: { reasonCode: decision.reasonCode, matchedRule: decision.matchedRule },
    });
    return { decision, exitCode: null, stdout: "", stderr: decision.reasonCode };
  }

  const result = await spawnCommand(input.command, input.args, manifest.workspacePath);
  await recordAgentAuditEvent({
    sessionId: input.sessionId,
    module: "agent-protect",
    action: "command_exec",
    decision: decision.effect,
    status: result.exitCode === 0 ? "allowed" : "failed",
    commandHash,
    executable,
    exitCode: result.exitCode,
    metadata: { reasonCode: decision.reasonCode },
  });
  return { decision, ...result };
}

export async function checkNetworkAccess(input: { sessionId: string; target: string }) {
  const manifest = await loadManifest(input.sessionId);
  const decision = evaluateNetworkTarget(input.target, manifest.policy);
  await recordAgentAuditEvent({
    sessionId: input.sessionId,
    module: "agent-protect",
    action: "network_access",
    decision: decision.effect,
    status: decision.effect === "ALLOW" ? "allowed" : "blocked",
    targetHost: hostFromTarget(input.target) ?? input.target,
    metadata: { reasonCode: decision.reasonCode, matchedRule: decision.matchedRule },
  });
  return decision;
}

export async function mediateToolInvocation(input: { sessionId: string; toolName: string }) {
  const manifest = await loadManifest(input.sessionId);
  const decision = evaluateToolInvocation(input.toolName, manifest.policy);
  await recordAgentAuditEvent({
    sessionId: input.sessionId,
    module: "agent-protect",
    action: "tool_invocation",
    decision: decision.effect,
    status:
      decision.effect === "ALLOW"
        ? "allowed"
        : decision.effect === "BLOCK"
          ? "blocked"
          : "pending_approval",
    toolName: input.toolName,
    metadata: { reasonCode: decision.reasonCode, matchedRule: decision.matchedRule },
  });
  return decision;
}

function spawnCommand(command: string, args: string[], cwd: string) {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      resolve({ exitCode: null, stdout, stderr: error.message });
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}
