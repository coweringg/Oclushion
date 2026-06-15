import type { EditorFile, EditorState, EditorEvent, EditorEventListener } from "./editor.types";

const MAX_RECENT_FILES = 20;

export class EditorStateService {
  private state: EditorState = {
    openFiles: [],
    activeFilePath: null,
    recentFiles: [],
    isSaving: false,
    lastSaveError: null,
  };

  private listeners = new Set<EditorEventListener>();

  openFile(file: EditorFile): void {
    const existing = this.state.openFiles.find((f) => f.path === file.path);
    if (existing) {
      this.setActiveFile(file.path);
      return;
    }
    this.state.openFiles.push(file);
    this.updateMRU(file.path);
    this.emit({ type: "file:opened", path: file.path });
    this.setActiveFile(file.path);
  }

  closeFile(path: string): void {
    const index = this.state.openFiles.findIndex((f) => f.path === path);
    if (index === -1) return;

    this.state.openFiles.splice(index, 1);

    if (this.state.activeFilePath === path) {
      const nextActive =
        this.state.openFiles[Math.min(index, this.state.openFiles.length - 1)]?.path ?? null;
      this.state.activeFilePath = nextActive;
      this.emit({ type: "tab:switched", from: path, to: nextActive });
    }

    this.emit({ type: "file:closed", path });
  }

  setActiveFile(path: string): void {
    const file = this.state.openFiles.find((f) => f.path === path);
    if (!file) return;

    const previous = this.state.activeFilePath;
    if (previous === path) return;

    this.state.activeFilePath = path;
    this.updateMRU(path);
    this.emit({ type: "tab:switched", from: previous, to: path });
  }

  markModified(path: string, content: string): void {
    const file = this.state.openFiles.find((f) => f.path === path);
    if (!file) return;

    file.content = content;
    file.modified = true;
    this.emit({ type: "file:modified", path, content });
  }

  markSaved(path: string, content: string): void {
    const file = this.state.openFiles.find((f) => f.path === path);
    if (!file) return;

    file.content = content;
    file.modified = false;
  }

  setSaving(saving: boolean): void {
    this.state.isSaving = saving;
  }

  setSaveError(error: string | null): void {
    this.state.lastSaveError = error;
  }

  revertFile(path: string, originalContent: string): void {
    const file = this.state.openFiles.find((f) => f.path === path);
    if (!file) return;

    file.content = originalContent;
    file.modified = false;
    this.emit({ type: "file:reverted", path });
  }

  emit(event: EditorEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  getActiveFile(): EditorFile | null {
    if (!this.state.activeFilePath) return null;
    return this.state.openFiles.find((f) => f.path === this.state.activeFilePath) ?? null;
  }

  getFile(path: string): EditorFile | undefined {
    return this.state.openFiles.find((f) => f.path === path);
  }

  getOpenFiles(): ReadonlyArray<EditorFile> {
    return this.state.openFiles;
  }

  hasUnsavedChanges(): boolean {
    return this.state.openFiles.some((f) => f.modified);
  }

  getUnsavedFiles(): EditorFile[] {
    return this.state.openFiles.filter((f) => f.modified);
  }

  getRecentFiles(): string[] {
    return this.state.recentFiles;
  }

  subscribe(listener: EditorEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateMRU(path: string): void {
    const filtered = this.state.recentFiles.filter((p) => p !== path);
    filtered.unshift(path);
    this.state.recentFiles = filtered.slice(0, MAX_RECENT_FILES);
  }
}
