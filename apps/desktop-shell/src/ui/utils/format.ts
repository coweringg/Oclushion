import type { AgentTask } from "../../agents/types";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}k`;
  }
  return String(tokens);
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function formatAgentTaskStatus(task: AgentTask): string {
  if (task.status === "running" && task.elapsedMs) {
    return `running for ${formatElapsed(task.elapsedMs)}`;
  }
  if (task.status === "completed" && task.startedAt && task.completedAt) {
    return `completed in ${formatElapsed(new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime())}`;
  }
  return task.status;
}

export function formatAuditType(type: string): string {
  return type
    .split("_")
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function estimateTokensFromText(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}
