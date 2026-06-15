import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { agentHome } from "./store.js";
import type { AgentAuditEvent } from "./types.js";

export function auditLogPath() {
  return path.join(agentHome(), "audit.jsonl");
}

export async function recordAgentAuditEvent(event: Omit<AgentAuditEvent, "eventId" | "occurredAt">) {
  await mkdir(agentHome(), { recursive: true });
  const payload: AgentAuditEvent = {
    ...event,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
  };
  await appendFile(auditLogPath(), `${JSON.stringify(payload)}\n`, "utf8");
  return payload;
}

export async function readAgentAuditEvents() {
  try {
    const log = await readFile(auditLogPath(), "utf8");
    return log
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AgentAuditEvent);
  } catch {
    return [];
  }
}

export function hashCommand(command: string, args: readonly string[]) {
  return createHash("sha256").update([command, ...args].join("\u0000")).digest("hex");
}
