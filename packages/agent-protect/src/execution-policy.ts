import path from "node:path";

import type { AgentExecutionDecision, AgentWorkspacePolicy } from "./types.js";

const urlPattern = /\bhttps?:\/\/[^\s"'`<>]+/giu;

export function evaluateCommand(
  command: string,
  args: readonly string[],
  policy: AgentWorkspacePolicy,
): AgentExecutionDecision {
  const executable = normalizeExecutable(command);
  const commandLine = [executable, ...args].join(" ");

  if (policy.blockedCommands.some((blocked) => normalizeExecutable(blocked) === executable)) {
    return decision("BLOCK", "blocked_command", executable);
  }

  const approvalMatch = policy.requireApprovalCommands.find((pattern) =>
    commandLine.toLowerCase().startsWith(pattern.toLowerCase()),
  );
  if (approvalMatch) {
    return decision("REQUIRE_APPROVAL", "command_requires_approval", approvalMatch);
  }

  const networkDecision = evaluateNetworkText(commandLine, policy);
  if (networkDecision.effect !== "ALLOW") {
    return networkDecision;
  }

  if (!policy.allowedCommands.some((allowed) => normalizeExecutable(allowed) === executable)) {
    return decision("BLOCK", "command_not_in_allowlist", executable);
  }

  return decision("ALLOW", "command_allowed", executable);
}

export function evaluateNetworkTarget(
  target: string,
  policy: AgentWorkspacePolicy,
): AgentExecutionDecision {
  const host = hostFromTarget(target);
  if (!host) {
    return decision("BLOCK", "network_target_invalid", target);
  }
  if (!policy.allowedNetworkHosts.includes(host)) {
    return decision("BLOCK", "network_host_not_allowed", host);
  }
  return decision("ALLOW", "network_host_allowed", host);
}

export function evaluateToolInvocation(
  toolName: string,
  policy: AgentWorkspacePolicy,
): AgentExecutionDecision {
  if (policy.blockedToolNames.includes(toolName)) {
    return decision("BLOCK", "tool_blocked", toolName);
  }
  if (policy.requireApprovalToolNames.includes(toolName)) {
    return decision("REQUIRE_APPROVAL", "tool_requires_approval", toolName);
  }
  return decision("ALLOW", "tool_allowed", toolName);
}

export function hostFromTarget(target: string) {
  try {
    return new URL(target).hostname;
  } catch {
    return target.includes(".") || target === "localhost" ? target : null;
  }
}

function evaluateNetworkText(text: string, policy: AgentWorkspacePolicy): AgentExecutionDecision {
  for (const match of text.matchAll(urlPattern)) {
    const target = match[0];
    const result = evaluateNetworkTarget(target, policy);
    if (result.effect !== "ALLOW") {
      return result;
    }
  }
  return decision("ALLOW", "no_disallowed_network_target", "network");
}

function decision(
  effect: AgentExecutionDecision["effect"],
  reasonCode: string,
  matchedRule: string,
): AgentExecutionDecision {
  return { effect, reasonCode, matchedRule };
}

function normalizeExecutable(command: string) {
  const base = path.basename(command).replace(/\.(?:cmd|exe|ps1|bat)$/iu, "");
  return base.toLowerCase();
}
