import { logger } from "../utils/logger.js";
import { invoke } from "@tauri-apps/api/core";

export type ApiKeyProvider = "openai" | "anthropic";

export type SecureKeyType = "apikey" | "session" | "license" | "encryption" | "hmac";

export type SecureKeyStore = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  save(): Promise<void>;
  readonly isSecure: boolean;
};

const memoryStore = new Map<string, unknown>();

class MemorySecureKeyStore implements SecureKeyStore {
  public readonly isSecure = false;

  public async get<T>(key: string): Promise<T | undefined> {
    return memoryStore.get(key) as T | undefined;
  }

  public async set(key: string, value: unknown): Promise<void> {
    memoryStore.set(key, value);
  }

  public async delete(key: string): Promise<boolean> {
    return memoryStore.delete(key);
  }

  public async save(): Promise<void> {
    return undefined;
  }
}

class LocalStorageKeyStore implements SecureKeyStore {
  public readonly isSecure = false;
  private static readonly STORAGE_KEY = "oclushion.secure-keys";

  private loadEntries(): Record<string, unknown> {
    try {
      const raw = globalThis.localStorage?.getItem(LocalStorageKeyStore.STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveEntries(entries: Record<string, unknown>): void {
    try {
      globalThis.localStorage?.setItem(LocalStorageKeyStore.STORAGE_KEY, JSON.stringify(entries));
    } catch {  }
  }

  public async get<T>(key: string): Promise<T | undefined> {
    return this.loadEntries()[key] as T | undefined;
  }

  public async set(key: string, value: unknown): Promise<void> {
    const entries = this.loadEntries();
    entries[key] = value;
    this.saveEntries(entries);
  }

  public async delete(key: string): Promise<boolean> {
    const entries = this.loadEntries();
    const existed = key in entries;
    delete entries[key];
    this.saveEntries(entries);
    return existed;
  }

  public async save(): Promise<void> {
    return undefined;
  }
}

class TauriKeychainStore implements SecureKeyStore {
  public readonly isSecure = true;
  private readonly fallback = new LocalStorageKeyStore();

  public async get<T>(key: string): Promise<T | undefined> {
    if (key.startsWith("apikey.")) {
      const provider = stripKeyPrefix(key);
      const value = await invoke<string | null>("load_api_key", { provider });
      return value as T | undefined;
    }
    return this.fallback.get<T>(key);
  }

  public async set(key: string, value: unknown): Promise<void> {
    if (key.startsWith("apikey.")) {
      const provider = stripKeyPrefix(key);
      await invoke("save_api_key", { provider, value: String(value ?? "") });
      return;
    }
    await this.fallback.set(key, value);
  }

  public async delete(key: string): Promise<boolean> {
    if (key.startsWith("apikey.")) {
      const provider = stripKeyPrefix(key);
      await invoke("delete_api_key", { provider });
      return true;
    }
    return this.fallback.delete(key);
  }

  public async save(): Promise<void> {
    return undefined;
  }
}

export class SecureKeysService {
  private storePromise: Promise<SecureKeyStore> | null = null;
  private _isSecure: boolean = true;

  public constructor(private readonly loadStore: () => Promise<SecureKeyStore> = loadDefaultStore) {}

  public async init(): Promise<void> {
    const store = await this.store();
    this._isSecure = store instanceof TauriKeychainStore;
    if (!this._isSecure) {
      logger.error("SecureKeys", "Using INSECURE in-memory key store. API keys will NOT persist between restarts. This must not happen in production.");
    }
  }

  public isSecure(): boolean {
    return this._isSecure;
  }

  public async saveKey(type: SecureKeyType, id: string, value: string): Promise<void> {
    const store = await this.store();
    const key = compoundKey(type, id);
    const trimmed = value.trim();
    if (trimmed) {
      await store.set(key, trimmed);
    } else {
      await store.delete(key);
    }
    await store.save();
  }

  public async loadKey(type: SecureKeyType, id: string): Promise<string | null> {
    const value = await (await this.store()).get<string>(compoundKey(type, id));
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  }

  public async deleteKey(type: SecureKeyType, id: string): Promise<void> {
    const store = await this.store();
    await store.delete(compoundKey(type, id));
    await store.save();
  }

  public async getOrCreateKey(type: SecureKeyType, id: string, byteLength = 32): Promise<string> {
    const existing = await this.loadKey(type, id);
    if (existing) {
      return existing;
    }
    const array = new Uint8Array(byteLength);
    crypto.getRandomValues(array);
    const generated = [...array].map((b) => b.toString(16).padStart(2, "0")).join("");
    await this.saveKey(type, id, generated);
    return generated;
  }

  public async saveApiKey(provider: ApiKeyProvider, value: string): Promise<void> {
    return this.saveKey("apikey", provider, value);
  }

  public async loadApiKey(provider: ApiKeyProvider): Promise<string | null> {
    return this.loadKey("apikey", provider);
  }

  public async deleteApiKey(provider: ApiKeyProvider): Promise<void> {
    return this.deleteKey("apikey", provider);
  }

  public async loadAll(): Promise<Record<ApiKeyProvider, string>> {
    const [openai, anthropic] = await Promise.all([
      this.loadApiKey("openai"),
      this.loadApiKey("anthropic"),
    ]);
    return {
      openai: openai ?? "",
      anthropic: anthropic ?? "",
    };
  }

  private async store(): Promise<SecureKeyStore> {
    this.storePromise ??= this.loadStore();
    return this.storePromise;
  }
}

export const secureKeysService = new SecureKeysService();

export function saveApiKey(provider: ApiKeyProvider, value: string): Promise<void> {
  return secureKeysService.saveApiKey(provider, value);
}

export function loadApiKey(provider: ApiKeyProvider): Promise<string | null> {
  return secureKeysService.loadApiKey(provider);
}

function compoundKey(type: SecureKeyType, id: string): string {
  return `${type}.${id}`;
}

function stripKeyPrefix(key: string): string {
  const dotIndex = key.indexOf(".");
  return dotIndex >= 0 ? key.slice(dotIndex + 1) : key;
}

async function loadDefaultStore(): Promise<SecureKeyStore> {
  if (!hasTauriRuntime()) {
    logger.warn("SecureKeys", "Using insecure in-memory key store. API keys are not persisted.");
    return new MemorySecureKeyStore();
  }
  return new TauriKeychainStore();
}

function hasTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
