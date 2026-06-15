import { z } from "zod";
import { logger } from "../utils/logger";

const jwtPayloadSchema = z.object({
  exp: z.number().optional(),
  role: z.enum(["owner", "admin", "security_officer", "auditor", "developer", "viewer"]).optional(),
});

export interface SessionStore {
  readonly isSecure: boolean;
  getSession(): Promise<SessionData | null>;
  setSession(data: SessionData): Promise<void>;
  clearSession(): Promise<void>;
}

export type SessionData = {
  token: string;
  user: Record<string, unknown>;
};

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payloadPart = parts[1];
    if (!payloadPart) return true;
    const jwtParsed = jwtPayloadSchema.safeParse(JSON.parse(atob(payloadPart)));
    const payload = jwtParsed.success ? jwtParsed.data : {};
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

const SESSION_STORAGE_KEY = "oclushion.session.v1";

export class LocalStorageSessionStore implements SessionStore {
  public readonly isSecure = false;

  public async getSession(): Promise<SessionData | null> {
    try {
      const raw = globalThis.localStorage?.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SessionData;
    } catch {
      await this.clearSession();
      return null;
    }
  }

  public async setSession(data: SessionData): Promise<void> {
    try {
      globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      logger.debug("SessionStore", "Failed to persist session to localStorage", error);
    }
  }

  public async clearSession(): Promise<void> {
    try {
      globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      logger.debug("SessionStore", "Failed to clear session from localStorage", error);
    }
  }
}

export class TauriSecureStoreSessionStore implements SessionStore {
  public readonly isSecure = true;

  public async getSession(): Promise<SessionData | null> {
    try {
      const raw = globalThis.localStorage?.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const metaParsed = z.object({ user: z.record(z.string(), z.unknown()) }).safeParse(JSON.parse(raw));
      if (!metaParsed.success) return null;
      const { user } = metaParsed.data;
      const { secureKeysService } = await import("../llm/secure-keys.service");
      const token = await secureKeysService.loadKey("session", "auth");
      if (!token) {
        await this.clearSession();
        return null;
      }
      if (isTokenExpired(token)) {
        logger.info("SessionStore", "Session token expired, forcing re-login.");
        await this.clearSession();
        return null;
      }
      return { token, user };
    } catch (error) {
      logger.debug("SessionStore", "Failed to read persisted session", error);
      await this.clearSession();
      return null;
    }
  }

  public async setSession(data: SessionData): Promise<void> {
    try {
      const { secureKeysService } = await import("../llm/secure-keys.service");
      await secureKeysService.saveKey("session", "auth", data.token);
      globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify({ user: data.user }));
    } catch (error) {
      logger.debug("SessionStore", "Failed to persist session", error);
    }
  }

  public async clearSession(): Promise<void> {
    try {
      const { secureKeysService } = await import("../llm/secure-keys.service");
      globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
      await secureKeysService.deleteKey("session", "auth");
    } catch (error) {
      logger.debug("SessionStore", "Failed to clear persisted session", error);
    }
  }
}

function hasTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function createSessionStore(): SessionStore {
  if (hasTauriRuntime()) {
    return new TauriSecureStoreSessionStore();
  }
  return new LocalStorageSessionStore();
}