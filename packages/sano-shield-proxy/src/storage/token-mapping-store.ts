import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { TokenMapping } from "../sanitizers/payload-sanitizer.js";

export interface TokenMappingStore {
  put(requestId: string, mapping: TokenMapping): Promise<void>;
  take(requestId: string): Promise<TokenMapping | null>;
  delete(requestId: string): Promise<void>;
}

export interface RedisMappingClient {
  set(key: string, value: string, expirationMode: "EX", seconds: number): Promise<unknown>;
  getdel(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

type EncryptedMapping = {
  iv: string;
  tag: string;
  ciphertext: string;
};

export class RedisTokenMappingStore implements TokenMappingStore {
  public constructor(
    private readonly redis: RedisMappingClient,
    private readonly encryptionKey: Buffer,
    private readonly ttlSeconds: number,
  ) {
    if (encryptionKey.byteLength !== 32) {
      throw new Error("TOKEN_MAPPING_ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }
  }

  public async put(requestId: string, mapping: TokenMapping): Promise<void> {
    const encrypted = encryptMapping(mapping, requestId, this.encryptionKey);
    await this.redis.set(keyFor(requestId), JSON.stringify(encrypted), "EX", this.ttlSeconds);
  }

  public async take(requestId: string): Promise<TokenMapping | null> {
    const stored = await this.redis.getdel(keyFor(requestId));
    if (stored === null) {
      return null;
    }

    return decryptMapping(JSON.parse(stored) as EncryptedMapping, requestId, this.encryptionKey);
  }

  public async delete(requestId: string): Promise<void> {
    await this.redis.del(keyFor(requestId));
  }
}

export class InMemoryTokenMappingStore implements TokenMappingStore {
  private readonly mappings = new Map<string, { value: TokenMapping; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  public constructor(ttlMs = 3_600_000, maxSize = 10_000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  public get size(): number {
    return this.mappings.size;
  }

  public async put(requestId: string, mapping: TokenMapping): Promise<void> {
    if (this.mappings.size >= this.maxSize) {
      this.evictExpired();
      if (this.mappings.size >= this.maxSize) {
        const entries = [...this.mappings.entries()]
          .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        const evictCount = Math.floor(this.maxSize * 0.1);
        for (let i = 0; i < evictCount && i < entries.length; i++) {
          const entry = entries[i];
          if (entry) {
            this.mappings.delete(entry[0]);
          }
        }
      }
    }
    this.mappings.set(requestId, {
      value: mapping,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  public async take(requestId: string): Promise<TokenMapping | null> {
    const entry = this.mappings.get(requestId);
    if (!entry) return null;
    this.mappings.delete(requestId);
    if (Date.now() > entry.expiresAt) return null;
    return entry.value;
  }

  public async delete(requestId: string): Promise<void> {
    this.mappings.delete(requestId);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.mappings) {
      if (now > entry.expiresAt) {
        this.mappings.delete(key);
      }
    }
  }
}

function encryptMapping(mapping: TokenMapping, requestId: string, key: Buffer): EncryptedMapping {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(requestId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(mapping)), cipher.final()]);

  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptMapping(encrypted: EncryptedMapping, requestId: string, key: Buffer): TokenMapping {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.iv, "base64"));
  decipher.setAAD(Buffer.from(requestId));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as TokenMapping;
}

function keyFor(requestId: string): string {
  return `sano:token-mapping:${requestId}`;
}
