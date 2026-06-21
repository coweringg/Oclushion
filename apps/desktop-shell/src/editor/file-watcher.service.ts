import { watch, type UnwatchFn, type WatchEvent } from "@tauri-apps/plugin-fs";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { logger } from "../utils/logger";

export type FileWatchEvent = {
  type: "modified" | "created" | "deleted";
  path: string;
};

export type FileWatchListener = (event: FileWatchEvent) => void;

function isModifyEvent(kind: unknown): boolean {
  return typeof kind === "object" && kind !== null && "modify" in kind;
}

function isCreateEvent(kind: unknown): boolean {
  return typeof kind === "object" && kind !== null && "create" in kind;
}

function isRemoveEvent(kind: unknown): boolean {
  return typeof kind === "object" && kind !== null && "remove" in kind;
}

export class FileWatcherService {
  private watchers = new Map<string, UnwatchFn>();
  private listeners = new Set<FileWatchListener>();

  async watchFile(absolutePath: string): Promise<void> {
    if (this.watchers.has(absolutePath)) return;

    try {
      const unwatch = await watch(
        absolutePath,
        (event: WatchEvent) => {
          const kind = event.type;
          let eventType: "modified" | "created" | "deleted";
          if (isModifyEvent(kind)) {
            eventType = "modified";
          } else if (isCreateEvent(kind)) {
            eventType = "created";
          } else if (isRemoveEvent(kind)) {
            eventType = "deleted";
          } else {
            return;
          }

          this.emit({ type: eventType, path: absolutePath });

          if (eventType === "modified") {
            void this.reloadFile(absolutePath);
          }
        },
      );
      this.watchers.set(absolutePath, unwatch);
    } catch (err) {
      logger.warn("FileWatcher", `Failed to set up watcher: ${absolutePath}`, err);
    }
  }

  async unwatchFile(absolutePath: string): Promise<void> {
    const unwatch = this.watchers.get(absolutePath);
    if (unwatch) {
      unwatch();
      this.watchers.delete(absolutePath);
    }
  }

  async unwatchAll(): Promise<void> {
    for (const [, unwatch] of this.watchers) {
      unwatch();
    }
    this.watchers.clear();
  }

  isWatching(absolutePath: string): boolean {
    return this.watchers.has(absolutePath);
  }

  getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }

  subscribe(listener: FileWatchListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async reloadFile(absolutePath: string): Promise<void> {
    try {
      await readTextFile(absolutePath);
      this.emit({ type: "modified", path: absolutePath });
    } catch (error) {
      logger.debug('FileWatcher', `File deleted or unreadable: ${absolutePath}`, error);
    }
  }

  private emit(event: FileWatchEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
