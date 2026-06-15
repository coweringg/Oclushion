import Database from "@tauri-apps/plugin-sql";
import { secureKeysService } from "./llm/secure-keys.service";

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly entries = new Map<string, string>();

  public async getItem(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

export class SqliteKeyValueStore implements KeyValueStore {
  private constructor(private readonly database: Database) {}

  public static async open(path?: string): Promise<SqliteKeyValueStore> {
    const encryptionKey = await getOrCreateEncryptionKey();
    const resolvedPath = path ?? `sqlite:workspace-${Math.random().toString(36).slice(2, 10)}.db?_cipher_key=${encryptionKey}`;
    const database = await Database.load(resolvedPath);
    await database.execute(
      `CREATE TABLE IF NOT EXISTS oclushion_kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    return new SqliteKeyValueStore(database);
  }

  public async getItem(key: string): Promise<string | null> {
    const rows = await this.database.select<Array<{ value: string }>>(
      "SELECT value FROM oclushion_kv_store WHERE key = $1 LIMIT 1",
      [key],
    );
    return rows[0]?.value ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    await this.database.execute(
      `INSERT INTO oclushion_kv_store (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                      updated_at = CURRENT_TIMESTAMP`,
      [key, value],
    );
  }

  public async removeItem(key: string): Promise<void> {
    await this.database.execute("DELETE FROM oclushion_kv_store WHERE key = $1", [key]);
  }
}

export async function createPersistentStore(): Promise<KeyValueStore> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return new MemoryKeyValueStore();
  }
  return SqliteKeyValueStore.open();
}

async function getOrCreateEncryptionKey(): Promise<string> {
  let key = await secureKeysService.loadKey("encryption", "sqlite");
  if (!key) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    key = Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
    await secureKeysService.saveKey("encryption", "sqlite", key);
  }
  return key;
}
