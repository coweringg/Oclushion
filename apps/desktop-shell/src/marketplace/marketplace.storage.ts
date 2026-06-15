import { exists, mkdir, readTextFile, remove, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { logger } from "../utils/logger";

export type MarketplaceFileSystem = {
  readText(path: string): Promise<string | null>;
  writeText(path: string, content: string): Promise<void>;
  writeBinary(path: string, content: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
};

export class TauriMarketplaceFileSystem implements MarketplaceFileSystem {
  public async readText(path: string): Promise<string | null> {
    try {
      return await readTextFile(path);
    } catch (error) {
      logger.debug('MarketplaceStorage', `Failed to read file: ${path}`, error);
      return null;
    }
  }

  public async writeText(path: string, content: string): Promise<void> {
    await this.ensureDir(parentDirectory(path));
    await writeTextFile(path, content);
  }

  public async writeBinary(path: string, content: Uint8Array): Promise<void> {
    await this.ensureDir(parentDirectory(path));
    await writeFile(path, content);
  }

  public async remove(path: string): Promise<void> {
    if (await exists(path)) {
      await remove(path, { recursive: true });
    }
  }

  public async exists(path: string): Promise<boolean> {
    return exists(path);
  }

  public async ensureDir(path: string): Promise<void> {
    if (!path) {
      return;
    }
    await mkdir(path, { recursive: true }).catch(() => undefined);
  }
}

export class MemoryMarketplaceFileSystem implements MarketplaceFileSystem {
  public readonly writes: string[] = [];
  public readonly binaryWrites: string[] = [];
  private readonly files = new Map<string, string>();
  private readonly binaryFiles = new Map<string, Uint8Array>();
  private readonly directories = new Set<string>();

  public async readText(path: string): Promise<string | null> {
    return this.files.get(normalizePath(path)) ?? null;
  }

  public async writeText(path: string, content: string): Promise<void> {
    const normalized = normalizePath(path);
    this.directories.add(parentDirectory(normalized));
    this.writes.push(normalized);
    this.files.set(normalized, content);
  }

  public async writeBinary(path: string, content: Uint8Array): Promise<void> {
    const normalized = normalizePath(path);
    this.directories.add(parentDirectory(normalized));
    this.writes.push(normalized);
    this.binaryWrites.push(normalized);
    this.binaryFiles.set(normalized, new Uint8Array(content));
  }

  public readBinary(path: string): Uint8Array | null {
    return this.binaryFiles.get(normalizePath(path)) ?? null;
  }

  public async remove(path: string): Promise<void> {
    const normalized = normalizePath(path);
    this.files.delete(normalized);
    this.binaryFiles.delete(normalized);
    for (const filePath of [...this.files.keys()]) {
      if (filePath.startsWith(`${normalized}/`)) {
        this.files.delete(filePath);
      }
    }
    for (const filePath of [...this.binaryFiles.keys()]) {
      if (filePath.startsWith(`${normalized}/`)) {
        this.binaryFiles.delete(filePath);
      }
    }
  }

  public async exists(path: string): Promise<boolean> {
    const normalized = normalizePath(path);
    return this.files.has(normalized) || this.binaryFiles.has(normalized) || this.directories.has(normalized);
  }

  public async ensureDir(path: string): Promise<void> {
    this.directories.add(normalizePath(path));
  }
}

export function joinMarketplacePath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join("/"));
}

function parentDirectory(path: string): string {
  return normalizePath(path.split("/").slice(0, -1).join("/"));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+/g, "/").replace(/\/$/, "");
}
