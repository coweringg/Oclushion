import { logger } from "../utils/logger";

export type AnalyticsEvent =
  | { name: "skill_installed"; properties: { skillId: string; skillName: string } }
  | { name: "prompt_sent"; properties: { provider: string; model: string; tokenCount: number } }
  | { name: "code_accepted"; properties: { fileCount: number; source: "fast_apply" | "safe_diff" | "agent" } }
  | { name: "agent_task_completed"; properties: { agentRole: string; durationSeconds: number; status: string } }
  | { name: "error_occurred"; properties: { source: string; message: string } }
  | { name: "feature_used"; properties: { feature: string } }
  | { name: "session_started"; properties: Record<string, never> }
  | { name: "session_ended"; properties: { durationMinutes: number } }
  | { name: "workspace_opened"; properties: { totalFiles: number } };

const EVENT_BUFFER: AnalyticsEvent[] = [];
const FLUSH_INTERVAL_MS = 30_000;
const BUFFER_LIMIT = 50;

let flushTimer: ReturnType<typeof setInterval> | null = null;

function getSessionId(): string {
  let sessionId = globalThis.sessionStorage?.getItem("ocl_analytics_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    globalThis.sessionStorage?.setItem("ocl_analytics_session_id", sessionId);
  }
  return sessionId;
}

function getUserId(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem("oclushion.session.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: { id?: string } };
    return parsed?.user?.id ?? null;
  } catch {
    return null;
  }
}

export function trackEvent(event: AnalyticsEvent): void {
  EVENT_BUFFER.push(event);
  if (EVENT_BUFFER.length >= BUFFER_LIMIT) {
    void flushEvents();
  }
}

export function startAnalytics(): void {
  trackEvent({ name: "session_started", properties: {} });
  if (flushTimer) return;
  flushTimer = setInterval(() => void flushEvents(), FLUSH_INTERVAL_MS);
}

export function stopAnalytics(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  void flushEvents();
}

async function flushEvents(): Promise<void> {
  if (EVENT_BUFFER.length === 0) return;

  const batch = EVENT_BUFFER.splice(0, BUFFER_LIMIT);
  const payload = {
    sessionId: getSessionId(),
    userId: getUserId(),
    timestamp: new Date().toISOString(),
    events: batch,
  };

  try {
    const controlApiUrl = (await import("../config/api")).getControlApiUrl();
    if (!controlApiUrl) return;

    await fetch(`${controlApiUrl}/v1/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    logger.debug("Analytics", "Failed to flush events", error);
  }
}