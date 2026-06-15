import { logger } from "../utils/logger.js";
import type { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { EditorFile, EditorEvent } from "./editor.types";
import { EditorStateService } from "./editor-state.service";
import { EditorActionsService } from "./editor-actions.service";
import { LanguageDetectorService } from "./language-detector.service";
import { FileWatcherService } from "./file-watcher.service";
import { DiffInlineService } from "./diff-inline.service";
import { EditorSettingsService } from "./editor-settings.service";
import { UndoRedoService } from "./undo-redo.service";
import { lineLinter } from "./line-linter.service";
import { createCodeReviewExtension } from "./code-review.extension";

export interface EditorControllerContext {
  readTextFile: (path: string) => Promise<string>;
  writeTextFile: (path: string, content: string) => Promise<void>;
  stat: (path: string) => Promise<{ size: number }>;
  rootPath: string;
}

export class EditorController {
  private stateService = new EditorStateService();
  private languageDetector = new LanguageDetectorService();
  private actionsService: EditorActionsService;
  private fileWatcher = new FileWatcherService();
  private diffService = new DiffInlineService();
  private settingsService = new EditorSettingsService();
  private undoRedoService = new UndoRedoService();
  private originalContents = new Map<string, string>();
  private openFileLocks = new Set<string>();
  private editorView: EditorView | null = null;
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private reviewExt: any = null;
  private unsubscribeWatcher: (() => void) | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ctx: EditorControllerContext) {
    this.actionsService = new EditorActionsService(this.stateService, this.languageDetector);
    this.unsubscribe = this.stateService.subscribe((event) => this.handleEvent(event));
    this.unsubscribeWatcher = this.fileWatcher.subscribe((event) => this.handleFileWatchEvent(event));
    this.unsubscribeSettings = this.settingsService.subscribe((event) => {
      if (event.type === "settings:changed" && event.key === "autoSave") {
        this.handleAutoSaveToggle(event.value as boolean);
      }
    });
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.createEditorView();
  }

  destroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.editorView?.destroy();
    this.editorView = null;
    this.container = null;
    this.unsubscribe?.();
    this.unsubscribeWatcher?.();
    this.unsubscribeSettings?.();
    void this.fileWatcher.unwatchAll();
  }

  private createEditorView(): void {
    const { EditorView } = require("@codemirror/view");
    const { EditorState } = require("@codemirror/state");
    const { lineNumbers, keymap, EditorView: EditorViewTheme, drawSelection, rectangularSelection, crosshairCursor } = require("@codemirror/view");
    const { defaultKeymap, history, historyKeymap } = require("@codemirror/commands");
    const { searchKeymap, highlightSelectionMatches } = require("@codemirror/search");
    const { autocompletion, closeBrackets } = require("@codemirror/autocomplete");
    const { foldGutter, indentOnInput, bracketMatching } = require("@codemirror/language");
    const { lintGutter, linter } = require("@codemirror/lint");

    this.editorView?.destroy();

    const activeFile = this.stateService.getActiveFile();
    const doc = activeFile?.content ?? "";
    const settings = this.settingsService.getAll();

    this.reviewExt = createCodeReviewExtension(
      [
        {
          id: "mock-1",
          authorId: "u2",
          authorName: "Maria (Senior)",
          message: "Esta función de auth no maneja bien los tokens expirados. Sugiero refactorizar.",
          lineNumber: 2,
          codeSnippet: "",
          status: "open",
          createdAt: new Date().toISOString()
        }
      ],
      (commentId) => {
        logger.info("EditorController", `Fix with AI triggered for comment ${commentId}`);
        const event = new CustomEvent("fix-with-ai", { detail: { commentId } });
        document.dispatchEvent(event);
      }
    );

    const extensions: Extension[] = [
      settings.lineNumbers ? lineNumbers() : [],
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      highlightSelectionMatches(),
      autocompletion(),
      closeBrackets(),
      bracketMatching(),
      settings.codeFolding ? foldGutter() : [],
      indentOnInput(),
      drawSelection(),
      rectangularSelection(),
      crosshairCursor(),
      lintGutter(),
      linter(lineLinter),
      this.reviewExt.reviewField,
      this.getLanguageExtension(activeFile?.language ?? "plaintext"),
      EditorViewTheme.theme({
        "&": {
          backgroundColor: "transparent",
          color: "#e7e3f5",
          fontSize: `${settings.fontSize}px`,
          height: "100%",
        },
        ".cm-scroller": {
          fontFamily: "var(--font-mono)",
          overflow: "auto",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--border-muted)",
          color: "rgba(255,255,255,0.26)",
        },
        ".cm-activeLineGutter, .cm-activeLine": {
          backgroundColor: "rgba(124, 58, 237, 0.08)",
        },
        ".cm-selectionBackground": {
          backgroundColor: "rgba(124, 58, 237, 0.25) !important",
        },
        ".cm-cursor": {
          borderLeftColor: "#a78bfa",
        },
      }),
      EditorView.updateListener.of((update: { state: { doc: { toString: () => string } }; docChanged: boolean }) => {
        if (update.docChanged) {
          const active = this.stateService.getActiveFile();
          if (active) {
            const content = update.state.doc.toString();
            this.undoRedoService.record(active.path, content);
            this.stateService.markModified(active.path, content);
            if (this.settingsService.get("autoSave")) {
              this.scheduleAutoSave();
            }
          }
        }
      }),
    ];

    if (settings.wordWrap) {
      extensions.push(EditorViewTheme.lineWrapping);
    }

    this.editorView = new EditorView({
      state: EditorState.create({
        doc,
        extensions,
      }),
      parent: this.container!,
    });

    this.editorView.dispatch({
      effects: this.reviewExt.setComments.of([
        {
          id: "mock-1",
          authorId: "u2",
          authorName: "Maria (Senior)",
          message: "Esta lógica es propensa a race conditions. Usa un Mutex.",
          lineNumber: 3,
          codeSnippet: "",
          status: "open",
          createdAt: new Date().toISOString()
        }
      ])
    });
  }

  async openFile(absolutePath: string, relativePath: string): Promise<void> {
    if (this.openFileLocks.has(relativePath)) return;
    this.openFileLocks.add(relativePath);
    try {
      await this.actionsService.openFile(absolutePath, relativePath, this.ctx.rootPath);
      const file = this.stateService.getFile(relativePath);
      if (file && !this.originalContents.has(relativePath)) {
        this.originalContents.set(relativePath, file.content);
      }
      await this.fileWatcher.watchFile(absolutePath);
    } finally {
      this.openFileLocks.delete(relativePath);
    }
  }

  async saveFile(): Promise<void> {
    const active = this.stateService.getActiveFile();
    if (!active) return;
    await this.actionsService.saveFile(active.path);
  }

  async saveAll(): Promise<void> {
    await this.actionsService.saveAll();
  }

  closeFile(path: string, force = false): void {
    const file = this.stateService.getFile(path);
    if (file && file.modified && !force) {
      const confirmed = window.confirm(`File "${path.split("/").pop()}" has unsaved changes. Close anyway?`);
      if (!confirmed) return;
    }
    if (file) {
      void this.fileWatcher.unwatchFile(file.absolutePath);
    }
    this.actionsService.closeFile(path);
  }

  closeActiveTab(force = false): void {
    const active = this.stateService.getActiveFile();
    if (active) this.closeFile(active.path, force);
  }

  async revertFile(path: string): Promise<void> {
    await this.actionsService.revertFile(path);
  }

  switchToTab(path: string): void {
    this.stateService.setActiveFile(path);
  }

  getActiveFile(): EditorFile | null {
    return this.stateService.getActiveFile();
  }

  getOpenFiles(): ReadonlyArray<EditorFile> {
    return this.stateService.getOpenFiles();
  }

  hasUnsavedChanges(): boolean {
    return this.stateService.hasUnsavedChanges();
  }

  getEditorContent(): string {
    return this.editorView?.state.doc.toString() ?? "";
  }

  getSettingsService(): EditorSettingsService {
    return this.settingsService;
  }

  getUndoRedoService(): UndoRedoService {
    return this.undoRedoService;
  }

  recordChange(): void {
    const active = this.stateService.getActiveFile();
    if (active) {
      this.undoRedoService.record(active.path, active.content);
    }
  }

  undo(): string | null {
    const active = this.stateService.getActiveFile();
    if (!active) return null;
    return this.undoRedoService.undo(active.path);
  }

  redo(): string | null {
    const active = this.stateService.getActiveFile();
    if (!active) return null;
    return this.undoRedoService.redo(active.path);
  }

  canUndo(): boolean {
    const active = this.stateService.getActiveFile();
    return active ? this.undoRedoService.canUndo(active.path) : false;
  }

  canRedo(): boolean {
    const active = this.stateService.getActiveFile();
    return active ? this.undoRedoService.canRedo(active.path) : false;
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    const delay = this.settingsService.get("autoSaveDelay");
    this.autoSaveTimer = setTimeout(() => {
      void this.saveFile();
    }, delay);
  }

  private handleAutoSaveToggle(enabled: boolean): void {
    if (!enabled && this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private handleEvent(event: EditorEvent): void {
    switch (event.type) {
      case "tab:switched": {
        const file = this.stateService.getActiveFile();
        if (file) this.syncEditorContent(file);
        break;
      }
      case "file:reverted": {
        const file = this.stateService.getFile(event.path);
        if (file) this.syncEditorContent(file);
        break;
      }
    }
  }

  private async handleFileWatchEvent(event: { type: string; path: string }): Promise<void> {
    if (event.type === "modified") {
      const file = this.stateService.getFile(
        this.stateService.getOpenFiles().find((f) => f.absolutePath === event.path)?.path ?? "",
      );
      if (file && !file.modified) {
        try {
          const content = await this.ctx.readTextFile(event.path);
          file.content = content;
          this.syncEditorContent(file);
        } catch (err) {
          logger.warn("Editor", "File watch read failed:", event.path, err);
        }
      }
    }
  }

  private syncEditorContent(file: EditorFile): void {
    if (!this.editorView) return;

    const currentContent = this.editorView.state.doc.toString();
    if (currentContent === file.content) return;

    this.editorView.dispatch({
      changes: {
        from: 0,
        to: this.editorView.state.doc.length,
        insert: file.content,
      },
    });
  }

  private getLanguageExtension(language: string): Extension {
    return this.languageDetector.getCodeMirrorLanguage(
      this.languageDetector.detect(language),
    );
  }
}
