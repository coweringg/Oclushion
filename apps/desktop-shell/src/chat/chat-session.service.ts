import Database from "@tauri-apps/plugin-sql";
import { logger } from "../utils/logger";
import { z } from "zod";

import type { KeyValueStore } from "../persistent-store";
import type { ChatMessage, ChatRole, ChatSession, ChatSessionWithMessages, GroupedSessions } from "./chat-session.types";

const fallbackKey = "oclushion.v2.chat-sessions.fallback";

type DatabaseLike = Pick<Database, "execute" | "select">;

type StoredFallback = {
  sessions: ChatSession[];
  messages: ChatMessage[];
};

export class ChatSessionService {
  private constructor(
    private readonly fallback: KeyValueStore,
    private readonly database: DatabaseLike | null,
  ) {}

  public static async create(fallback: KeyValueStore, database?: DatabaseLike | null): Promise<ChatSessionService> {
    if (database !== undefined) {
      const service = new ChatSessionService(fallback, database);
      await service.migrate();
      return service;
    }
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return new ChatSessionService(fallback, null);
    }
    const sqlite = await Database.load("sqlite:workspace.db");
    const service = new ChatSessionService(fallback, sqlite);
    await service.migrate();
    return service;
  }

  public async listSessions(): Promise<GroupedSessions> {
    const sessions = await this.listFlatSessions();
    return groupSessionsByDate(sessions);
  }

  public async listFlatSessions(): Promise<ChatSession[]> {
    if (this.database) {
      const rows = await this.database.select<Array<ChatSessionRow>>(
        `SELECT id, title, created_at, updated_at, is_archived
         FROM chat_sessions
         WHERE is_archived = 0
         ORDER BY updated_at DESC`,
      );
      return rows.map(mapSessionRow);
    }
    return (await this.readFallback()).sessions
      .filter((session) => !session.isArchived)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  public async createSession(title = "New Chat"): Promise<ChatSession> {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: createId("chat"),
      title,
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    };
    if (this.database) {
      await this.database.execute(
        `INSERT INTO chat_sessions (id, title, created_at, updated_at, is_archived)
         VALUES ($1, $2, $3, $4, 0)`,
        [session.id, session.title, session.createdAt, session.updatedAt],
      );
      return session;
    }
    const snapshot = await this.readFallback();
    snapshot.sessions = [session, ...snapshot.sessions];
    await this.writeFallback(snapshot);
    return session;
  }

  public async loadSession(sessionId: string): Promise<ChatSessionWithMessages> {
    if (this.database) {
      const sessions = await this.database.select<Array<ChatSessionRow>>(
        `SELECT id, title, created_at, updated_at, is_archived
         FROM chat_sessions
         WHERE id = $1
         LIMIT 1`,
        [sessionId],
      );
      const session = sessions[0];
      if (!session) {
        throw new Error(`Chat session not found: ${sessionId}`);
      }
      const messages = await this.database.select<Array<ChatMessageRow>>(
        `SELECT id, session_id, role, content, model, metadata, created_at
         FROM chat_messages
         WHERE session_id = $1
         ORDER BY created_at ASC`,
        [sessionId],
      );
      return {
        ...mapSessionRow(session),
        messages: messages.map(mapMessageRow),
      };
    }
    const snapshot = await this.readFallback();
    const session = snapshot.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    return {
      ...session,
      messages: snapshot.messages
        .filter((message) => message.sessionId === sessionId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    };
  }

  public async appendMessage(
    sessionId: string,
    input: Omit<ChatMessage, "id" | "sessionId" | "createdAt"> & { id?: string; createdAt?: string },
  ): Promise<ChatMessage> {
    const now = input.createdAt ?? new Date().toISOString();
    const message: ChatMessage = {
      id: input.id ?? createId("message"),
      sessionId,
      role: input.role,
      content: input.content,
      model: input.model,
      metadata: input.metadata,
      createdAt: now,
    };
    if (this.database) {
      await this.database.execute(
        `INSERT INTO chat_messages (id, session_id, role, content, model, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          message.id,
          message.sessionId,
          message.role,
          message.content,
          message.model ?? null,
          message.metadata ? JSON.stringify(message.metadata) : null,
          message.createdAt,
        ],
      );
      await this.database.execute("UPDATE chat_sessions SET updated_at = $1 WHERE id = $2", [now, sessionId]);
      return message;
    }
    const snapshot = await this.readFallback();
    snapshot.messages.push(message);
    snapshot.sessions = snapshot.sessions.map((session) =>
      session.id === sessionId ? { ...session, updatedAt: now } : session,
    );
    await this.writeFallback(snapshot);
    return message;
  }

  public async renameSession(sessionId: string, title: string): Promise<void> {
    const cleanTitle = title.trim().slice(0, 72) || "New Chat";
    const now = new Date().toISOString();
    if (this.database) {
      await this.database.execute("UPDATE chat_sessions SET title = $1, updated_at = $2 WHERE id = $3", [
        cleanTitle,
        now,
        sessionId,
      ]);
      return;
    }
    const snapshot = await this.readFallback();
    snapshot.sessions = snapshot.sessions.map((session) =>
      session.id === sessionId ? { ...session, title: cleanTitle, updatedAt: now } : session,
    );
    await this.writeFallback(snapshot);
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    if (this.database) {
      await this.database.execute("UPDATE chat_sessions SET is_archived = 1, updated_at = $1 WHERE id = $2", [
        now,
        sessionId,
      ]);
      return;
    }
    const snapshot = await this.readFallback();
    snapshot.sessions = snapshot.sessions.map((session) =>
      session.id === sessionId ? { ...session, isArchived: true, updatedAt: now } : session,
    );
    await this.writeFallback(snapshot);
  }

  public async spawnAgentChat(title: string, systemContext: string): Promise<ChatSession> {
    const session = await this.createSession(title);
    await this.appendMessage(session.id, {
      role: "system",
      content: systemContext,
      metadata: { spawnedBy: "agent", tool: "spawn_new_chat" },
    });
    return session;
  }

  private async migrate(): Promise<void> {
    if (!this.database) {
      return;
    }
    await this.database.execute(
      `CREATE TABLE IF NOT EXISTS chat_sessions (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_archived INTEGER NOT NULL DEFAULT 0
      )`,
    );
    await this.database.execute(
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role        TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
        content     TEXT NOT NULL,
        model       TEXT,
        metadata    TEXT,
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await this.database.execute(
      "CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at)",
    );
  }

  private async readFallback(): Promise<StoredFallback> {
    const raw = await this.fallback.getItem(fallbackKey);
    if (!raw) {
      return { sessions: [], messages: [] };
    }
    try {
      const parsed = z.object({
        sessions: z.array(z.unknown()).optional(),
        messages: z.array(z.unknown()).optional(),
      }).safeParse(JSON.parse(raw));
      if (!parsed.success) {
        return { sessions: [], messages: [] };
      }
      return {
        sessions: parsed.data.sessions ? parsed.data.sessions.filter(isSession) : [],
        messages: parsed.data.messages ? parsed.data.messages.filter(isMessage) : [],
      };
    } catch (error) {
      logger.warn('ChatSession', 'Failed to parse fallback data, clearing', error);
      await this.fallback.removeItem(fallbackKey);
      return { sessions: [], messages: [] };
    }
  }

  private async writeFallback(snapshot: StoredFallback): Promise<void> {
    await this.fallback.setItem(fallbackKey, JSON.stringify(snapshot));
  }
}

type ChatSessionRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: number;
};

type ChatMessageRow = {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  model: string | null;
  metadata: string | null;
  created_at: string;
};

function mapSessionRow(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isArchived: row.is_archived === 1,
  };
}

function mapMessageRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    model: row.model ?? undefined,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

function parseMetadata(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function groupSessionsByDate(sessions: ChatSession[]): GroupedSessions {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86_400_000;
  const startWeek = startToday - 6 * 86_400_000;
  const grouped: GroupedSessions = { today: [], yesterday: [], thisWeek: [], older: [] };
  for (const session of sessions) {
    const timestamp = new Date(session.updatedAt).getTime();
    if (timestamp >= startToday) {
      grouped.today.push(session);
    } else if (timestamp >= startYesterday) {
      grouped.yesterday.push(session);
    } else if (timestamp >= startWeek) {
      grouped.thisWeek.push(session);
    } else {
      grouped.older.push(session);
    }
  }
  return grouped;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
}

function isSession(value: unknown): value is ChatSession {
  const session = value as Partial<ChatSession>;
  return typeof session?.id === "string" && typeof session.title === "string";
}

function isMessage(value: unknown): value is ChatMessage {
  const message = value as Partial<ChatMessage>;
  return typeof message?.id === "string" && typeof message.sessionId === "string" && typeof message.content === "string";
}
