import { z } from "zod";
import type { SessionStore, SessionData } from "./session-store.js";
import { logger } from "../utils/logger.js";

const sessionPayloadSchema = z.object({
  token: z.string(),
  user: z.record(z.string(), z.unknown()),
  exp: z.number().optional(),
});

export class RedisSessionStore implements SessionStore {
  public readonly isSecure = true;
  private baseUrl: string;

  public constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.REDIS_SESSION_URL ?? "http://localhost:8082";
  }

  public async getSession(): Promise<SessionData | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/v1/internal/session`, {
        headers: { authorization: `Bearer ${process.env.CONTROL_API_INTERNAL_TOKEN ?? ""}` },
      });
      if (!resp.ok) return null;
      const data = sessionPayloadSchema.parse(await resp.json());
      if (data.exp && Date.now() >= data.exp * 1000) return null;
      return { token: data.token, user: data.user as Record<string, unknown> };
    } catch (err) {
      logger.warn("RedisSessionStore", "Failed to get session", err);
      return null;
    }
  }

  public async setSession(data: SessionData): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/v1/internal/session`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.CONTROL_API_INTERNAL_TOKEN ?? ""}`,
        },
        body: JSON.stringify(data),
      });
    } catch (err) {
      logger.warn("RedisSessionStore", "Failed to set session", err);
    }
  }

  public async clearSession(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/v1/internal/session`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${process.env.CONTROL_API_INTERNAL_TOKEN ?? ""}` },
      });
    } catch (err) {
      logger.warn("RedisSessionStore", "Failed to clear session", err);
    }
  }
}
