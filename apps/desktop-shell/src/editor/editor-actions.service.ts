import { logger } from "../utils/logger.js";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { EditorFile } from "./editor.types";
import { EditorStateService } from "./editor-state.service";
import { LanguageDetectorService } from "./language-detector.service";

const BLOCKED_PATHS = [".env", "secrets/", ".git/", ".ssh/", "id_rsa", ".oclushion-tools/"];

export class EditorActionsService {
  constructor(
    private readonly stateService: EditorStateService,
    private readonly languageDetector: LanguageDetectorService,
  ) {}

  async openFile(absolutePath: string, relativePath: string, rootPath: string, signal?: AbortSignal): Promise<void> {
    if (!this.validatePath(relativePath, rootPath)) {
      throw new Error(`Access denied: ${relativePath}`);
    }

    const existing = this.stateService.getFile(relativePath);
    if (existing) {
      this.stateService.setActiveFile(relativePath);
      return;
    }

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const content = await readTextFile(absolutePath);
    const extension = relativePath.split(".").pop()?.toLowerCase() ?? "";
    const language = this.languageDetector.detect(extension);

    const stat = await this.getFileSize(absolutePath);

    const file: EditorFile = {
      path: relativePath,
      absolutePath,
      content,
      language,
      size: stat,
      modified: false,
      createdAt: Date.now(),
    };

    this.stateService.openFile(file);
  }

  async saveFile(path: string): Promise<void> {
    const file = this.stateService.getFile(path);
    if (!file) return;

    this.stateService.setSaving(true);
    this.stateService.setSaveError(null);

    try {
      await writeTextFile(file.absolutePath, file.content);
      this.stateService.markSaved(path, file.content);
      this.stateService.emit({ type: "save:completed", path });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.stateService.setSaveError(message);
      this.stateService.emit({ type: "save:failed", path, error: message });
      throw error;
    } finally {
      this.stateService.setSaving(false);
    }
  }

  async saveAll(): Promise<void> {
    const unsaved = this.stateService.getUnsavedFiles();
    await Promise.allSettled(unsaved.map((f) => this.saveFile(f.path)));
  }

  closeFile(path: string): void {
    this.stateService.closeFile(path);
  }

  async revertFile(path: string): Promise<void> {
    const file = this.stateService.getFile(path);
    if (!file) return;

    const content = await readTextFile(file.absolutePath);
    this.stateService.revertFile(path, content);
  }

  validatePath(path: string, rootPath: string): boolean {
    if (path.includes("..")) return false;
    if (BLOCKED_PATHS.some((blocked) => path.includes(blocked))) return false;

    const normalizedRoot = rootPath.replace(/\\/g, "/").replace(/\/$/, "");
    const normalizedPath = path.replace(/\\/g, "/");

    const resolved = [normalizedRoot, ...normalizedPath.split("/")].join("/");
    if (!resolved.startsWith(normalizedRoot)) return false;

    return true;
  }

  private async getFileSize(absolutePath: string): Promise<number> {
    try {
      const { stat: fsStat } = await import("@tauri-apps/plugin-fs");
      const info = await fsStat(absolutePath);
      return info.size;
    } catch (err) {
      logger.warn("EditorActions", "Failed to get file size:", err);
      return 0;
    }
  }
}
