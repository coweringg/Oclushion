import { z } from "zod";
import { logger } from "./utils/logger";
import { getControlApiUrl } from "./config/api";
import { createSessionStore, type SessionStore } from "./security/session-store";

const ssoAuthorizeResponseSchema = z.object({
  redirectUrl: z.string(),
  flowId: z.string(),
});

const ssoPollResponseSchema = z.object({
  status: z.string(),
  token: z.string().optional(),
  user: z.record(z.string(), z.unknown()).optional(),
});

const errorResponseSchema = z.object({
  error: z.string().optional(),
  message: z.unknown().optional(),
});

const jwtPayloadSchema = z.object({
  exp: z.number().optional(),
  role: z.enum(["owner", "admin", "security_officer", "auditor", "developer", "viewer"]).optional(),
});

export function getRoleFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const parsed = jwtPayloadSchema.safeParse(JSON.parse(atob(payload)));
    return parsed.success ? (parsed.data.role ?? null) : null;
  } catch {
    return null;
  }
}

export type OclushionPlan = "Free" | "Pro" | "Team" | "Enterprise";

export type OclushionSession = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    plan: OclushionPlan;
    organizationId: string;
    planRenewalDate: string;
  };
};

type SessionListener = (session: OclushionSession | null) => void;

const sessionStore: SessionStore = createSessionStore();
const listeners = new Set<SessionListener>();
let currentSession: OclushionSession | null = null;

void restoreSession().then((session) => {
  currentSession = session;
  listeners.forEach((l) => l(session));
});

export function getStoredSession(): OclushionSession | null {
  return currentSession;
}

export async function loginWithControlApi(input: {
  email: string;
  password: string;
}): Promise<OclushionSession> {
  const response = await fetchControlApi("/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Control API login failed with HTTP ${response.status}`);
  }
  const session = normalizeSession(await response.json());
  setCurrentSession(session);
  return session;
}

export async function startSSOFlow(domain: string): Promise<{ redirectUrl: string; flowId: string }> {
  const response = await fetchControlApi("/v1/auth/sso/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!response.ok) {
    const error = await readControlApiError(response, "SSO authorize failed");
    throw new Error(error);
  }
  const ssoParsed = ssoAuthorizeResponseSchema.safeParse(await response.json());
  if (!ssoParsed.success) throw new Error("Invalid SSO authorize response");
  return ssoParsed.data;
}

export async function pollSSO(flowId: string): Promise<OclushionSession | null> {
  const response = await fetchControlApi(`/v1/auth/sso/poll?flowId=${encodeURIComponent(flowId)}`, {});
  if (!response.ok) return null;
  const ssoParsed = ssoPollResponseSchema.safeParse(await response.json());
  const data = ssoParsed.success ? ssoParsed.data : { status: "pending" };
  if (data.status !== "completed" || !data.token || !data.user) return null;
  const session = normalizeSession({ token: data.token, user: data.user });
  setCurrentSession(session);
  return session;
}

export async function registerWithControlApi(input: {
  name: string;
  email: string;
  password: string;
}): Promise<OclushionSession> {
  const response = await fetchControlApi("/v1/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Native registration is not enabled in the Control API yet.");
    }
    throw new Error(await readControlApiError(response, "Control API registration failed"));
  }
  const session = normalizeSession(await response.json());
  setCurrentSession(session);
  return session;
}

export function logout(): void {
  setCurrentSession(null);
}

export function subscribeToSession(listener: SessionListener): () => void {
  listeners.add(listener);
  listener(currentSession);
  return () => listeners.delete(listener);
}

export function formatPlanRenewal(session: OclushionSession | null): string {
  if (!session) {
    return "Sign in to sync your Oclushion plan";
  }
  const date = new Date(session.user.planRenewalDate);
  if (Number.isNaN(date.getTime())) {
    return `${session.user.plan} plan active`;
  }
  return `${session.user.plan} plan renews ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export { getControlApiUrl } from "./config/api";

function normalizeSession(value: unknown): OclushionSession {
  if (!value || typeof value !== "object") {
    throw new Error("Control API returned an invalid session payload.");
  }
  const payload = value as Partial<OclushionSession>;
  if (typeof payload.token !== "string" || !payload.user) {
    throw new Error("Control API returned an invalid session payload.");
  }
  return {
    token: payload.token,
    user: {
      id: String(payload.user.id),
      email: String(payload.user.email),
      name: String(payload.user.name),
      plan: normalizePlan(payload.user.plan),
      organizationId: String(payload.user.organizationId),
      planRenewalDate: String(payload.user.planRenewalDate),
    },
  };
}

function normalizePlan(value: unknown): OclushionPlan {
  if (value === "Free" || value === "Pro" || value === "Team" || value === "Enterprise") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "free") {
      return "Free";
    }
    if (normalized === "pro") {
      return "Pro";
    }
    if (normalized === "team") {
      return "Team";
    }
    if (normalized === "enterprise") {
      return "Enterprise";
    }
  }
  return "Free";
}

async function fetchControlApi(path: string, init: RequestInit): Promise<Response> {
  const baseUrl = getControlApiUrl();
  if (!baseUrl) {
    throw new Error("Control API is not configured. Set VITE_OCLUSHION_CONTROL_API_URL.");
  }
  const url = `${baseUrl}${path}`;
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new Error(
      `Unable to reach Oclushion Control API at ${url}. Make sure the backend is running and reachable.`,
      { cause: error },
    );
  }
}

async function readControlApiError(response: Response, fallback: string): Promise<string> {
  try {
    const errParsed = errorResponseSchema.safeParse(await response.json());
    const payload = errParsed.success ? errParsed.data : {};
    const message = typeof payload.error === "string" ? payload.error : payload.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch (error) {
    logger.debug('AuthService', 'Failed to parse error response body', error);
  }
  return `${fallback} with HTTP ${response.status}`;
}

function emitSession(session: OclushionSession | null): void {
  listeners.forEach((listener) => listener(session));
}

function setCurrentSession(session: OclushionSession | null): void {
  currentSession = session;
  void persistSession(session);
  emitSession(session);
}

async function restoreSession(): Promise<OclushionSession | null> {
  try {
    const data = await sessionStore.getSession();
    if (!data) return null;
    return normalizeSession(data);
  } catch (error) {
    logger.debug('AuthService', 'Failed to restore persisted session', error);
    return null;
  }
}

async function persistSession(session: OclushionSession | null): Promise<void> {
  try {
    if (session) {
      await sessionStore.setSession({ token: session.token, user: session.user as Record<string, unknown> });
    } else {
      await sessionStore.clearSession();
    }
  } catch (error) {
    logger.debug('AuthService', 'Failed to persist session', error);
  }
}
