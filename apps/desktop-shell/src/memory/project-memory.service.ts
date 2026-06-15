import Database from "@tauri-apps/plugin-sql";
import type { KeyValueStore } from "../persistent-store";
import { logger } from "../utils/logger";
import { z } from "zod";
import type { MemoryEntry, MemorySource, MemoryType } from "./memory.types";
import { semanticEmbedder } from "../embeddings/semantic-embedder";

const memoryFallbackKey = "oclushion.v2.project-memory.fallback";
const learnPatterns: Array<{ pattern: RegExp; type: MemoryType }> = [
  { pattern: /usamos|usemos|el proyecto usa/iu, type: "fact" },
  { pattern: /decidimos|la decisi[oó]n es|decidido/iu, type: "decision" },
  { pattern: /siempre|nunca|obligatorio|regla/iu, type: "convention" },
  { pattern: /el comando para|para correr|para buildear/iu, type: "command" },
  { pattern: /la arquitectura|seguimos el patr[oó]n/iu, type: "architecture" },
];

export class ProjectMemoryService {
  private constructor(
    private readonly fallback: KeyValueStore,
    private readonly database: Database | null,
  ) {}

  public static async create(fallback: KeyValueStore): Promise<ProjectMemoryService> {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return new ProjectMemoryService(fallback, null);
    }
    const database = await Database.load("sqlite:workspace.db");
    await database.execute(
      `CREATE TABLE IF NOT EXISTS project_memory (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0,
        embedding TEXT
      )`,
    );
    await database.execute(
      `CREATE VIRTUAL TABLE IF NOT EXISTS project_memory_fts
       USING fts5(id UNINDEXED, content, tags, tokenize='porter unicode61')`,
    );
    return new ProjectMemoryService(fallback, database);
  }

  public async add(input: {
    type: MemoryType;
    content: string;
    tags?: string[];
    source: MemorySource;
    confidence?: number;
  }): Promise<MemoryEntry> {
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: `memory-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`,
      type: input.type,
      content: input.content.trim(),
      tags: input.tags ?? inferTags(input.content),
      source: input.source,
      confidence: input.confidence ?? 0.85,
      createdAt: now,
      lastUsedAt: now,
      usageCount: 0,
    };
    
    const embeddingVec = await semanticEmbedder.embed(entry.content);
    if (embeddingVec) {
      entry.embedding = embeddingVec;
    }

    if (this.database) {
      await this.database.execute(
        `INSERT INTO project_memory
         (id, type, content, tags, source, confidence, created_at, last_used_at, usage_count, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9)`,
        [
          entry.id,
          entry.type,
          entry.content,
          JSON.stringify(entry.tags),
          entry.source,
          entry.confidence,
          entry.createdAt,
          entry.lastUsedAt,
          embeddingVec ? JSON.stringify(Array.from(embeddingVec)) : null,
        ],
      );
      await this.database.execute(
        "INSERT INTO project_memory_fts (id, content, tags) VALUES ($1, $2, $3)",
        [entry.id, entry.content, entry.tags.join(" ")],
      );
    } else {
      const entries = await this.list();
      await this.fallback.setItem(memoryFallbackKey, JSON.stringify([entry, ...entries]));
    }
    return entry;
  }

  public async learnFromText(text: string, source: MemorySource): Promise<MemoryEntry[]> {
    const sentences = text
      .split(/[.!?\n]/u)
      .map((part) => part.trim())
      .filter((part) => part.length > 12);
    const learned: MemoryEntry[] = [];
    for (const sentence of sentences) {
      const match = learnPatterns.find((pattern) => pattern.pattern.test(sentence));
      if (match) {
        learned.push(await this.add({ type: match.type, content: sentence, source }));
      }
    }
    return learned;
  }

  public async search(query: string, limit = 5): Promise<MemoryEntry[]> {
    const normalizedQuery = escapeFtsQuery(query);
    const queryEmbedding = await semanticEmbedder.embed(query);

    if (!normalizedQuery && !queryEmbedding) {
      return (await this.list()).slice(0, limit);
    }

    if (this.database) {
      let ftsRows: any[] = [];
      if (normalizedQuery) {
        ftsRows = await this.database.select(
          `SELECT pm.id, fts.rank as fts_rank
           FROM project_memory_fts fts
           JOIN project_memory pm ON pm.id = fts.id
           WHERE project_memory_fts MATCH $1
           LIMIT 50`,
          [normalizedQuery]
        );
      }

      const allRows = await this.database.select<any[]>("SELECT * FROM project_memory");
      
      const scoredEntries = allRows.map((row) => {
        const memory = rowToMemory(row);
        let score = 0;
        
        if (queryEmbedding && row.embedding) {
          try {
            const vec = new Float64Array(JSON.parse(row.embedding));
            const sim = semanticEmbedder.cosineSimilarity(queryEmbedding, vec);
            score += sim * 0.7; // 70% weight to Semantic Similarity
          } catch {}
        }
        
        const ftsMatch = ftsRows.find(f => f.id === row.id);
        if (ftsMatch) {
          score += 0.3; // 30% weight to Exact Keyword Match
        }

        return { memory, score };
      });

      scoredEntries.sort((a, b) => b.score - a.score);
      const top = scoredEntries
        .filter(e => e.score > 0.15)
        .slice(0, limit)
        .map(e => e.memory);

      if (top.length > 0) {
        await this.markUsed(top.map((m) => m.id));
      }
      return top.length > 0 ? top : scoredEntries.slice(0, limit).map(e => e.memory);
    }

    return (await this.list())
      .filter((entry) => entry.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
  }

  public async list(): Promise<MemoryEntry[]> {
    if (this.database) {
      const rows = await this.database.select<
        Array<{
          id: string;
          type: MemoryType;
          content: string;
          tags: string;
          source: MemorySource;
          confidence: number;
          created_at: string;
          last_used_at: string;
          usage_count: number;
          embedding: string | null;
        }>
      >("SELECT * FROM project_memory ORDER BY created_at DESC LIMIT 100");
      return rows.map(rowToMemory);
    }
    const raw = await this.fallback.getItem(memoryFallbackKey);
    if (!raw) {
      return [];
    }
    try {
      const parsed = z.array(z.unknown()).safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data.filter(isMemoryEntry) : [];
    } catch (error) {
      logger.warn('ProjectMemory', 'Failed to parse memory fallback data', error);
      await this.fallback.removeItem(memoryFallbackKey);
      return [];
    }
  }

  public async remove(id: string): Promise<void> {
    if (this.database) {
      await this.database.execute("DELETE FROM project_memory WHERE id = $1", [id]);
      await this.database.execute("DELETE FROM project_memory_fts WHERE id = $1", [id]);
    } else {
      const entries = await this.list();
      const filtered = entries.filter(e => e.id !== id);
      await this.fallback.setItem(memoryFallbackKey, JSON.stringify(filtered));
    }
  }

  public async buildPromptContext(query: string): Promise<string> {
    const memories = await this.search(query, 6);
    if (!memories.length) {
      return "";
    }
    return `<project_memory>\n${memories.map((entry) => `<${entry.type}>${entry.content}</${entry.type}>`).join("\n")}\n</project_memory>`;
  }

  private async markUsed(ids: string[]): Promise<void> {
    if (!this.database || !ids.length) {
      return;
    }
    for (const id of ids) {
      await this.database.execute(
        "UPDATE project_memory SET usage_count = usage_count + 1, last_used_at = $2 WHERE id = $1",
        [id, new Date().toISOString()],
      );
    }
  }
}

function rowToMemory(row: {
  id: string;
  type: MemoryType;
  content: string;
  tags: string;
  source: MemorySource;
  confidence: number;
  created_at: string;
  last_used_at: string;
  usage_count: number;
  embedding: string | null;
}): MemoryEntry {
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    tags: parseTags(row.tags),
    source: row.source,
    confidence: row.confidence,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    usageCount: row.usage_count,
    embedding: row.embedding ? new Float64Array(JSON.parse(row.embedding)) : undefined,
  };
}

function inferTags(content: string): string[] {
  return [...new Set(content.toLowerCase().match(/[a-z0-9-]{4,}/gu) ?? [])].slice(0, 8);
}

function escapeFtsQuery(query: string): string {
  return query
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 8)
    .join(" OR ");
}

function isMemoryEntry(value: unknown): value is MemoryEntry {
  return Boolean(value && typeof value === "object" && typeof (value as MemoryEntry).id === "string");
}

function parseTags(raw: string): string[] {
  try {
    const parsed = z.array(z.string()).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
