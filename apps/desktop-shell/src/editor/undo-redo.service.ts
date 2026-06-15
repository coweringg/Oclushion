import type { DiffLine } from "./editor.types";

export type FileDiff = {
  filePath: string;
  fileName: string;
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
};

export type UndoRedoEvent =
  | { type: "history:recorded"; filePath: string; timestamp: number }
  | { type: "history:undone"; filePath: string }
  | { type: "history:redone"; filePath: string };

export type UndoRedoListener = (event: UndoRedoEvent) => void;

const MAX_HISTORY_ENTRIES = 100;

export class UndoRedoService {
  private history = new Map<string, string[]>();
  private currentIndex = new Map<string, number>();
  private listeners = new Set<UndoRedoListener>();

  record(filePath: string, content: string): void {
    const entries = this.history.get(filePath) ?? [];
    const index = this.currentIndex.get(filePath) ?? -1;

    const newEntries = entries.slice(0, index + 1);
    newEntries.push(content);

    if (newEntries.length > MAX_HISTORY_ENTRIES) {
      newEntries.splice(0, newEntries.length - MAX_HISTORY_ENTRIES);
    }

    this.history.set(filePath, newEntries);
    this.currentIndex.set(filePath, newEntries.length - 1);

    this.emit({ type: "history:recorded", filePath, timestamp: Date.now() });
  }

  undo(filePath: string): string | null {
    const entries = this.history.get(filePath);
    const index = this.currentIndex.get(filePath);

    if (!entries || index === undefined || index <= 0) return null;

    const newIndex = index - 1;
    this.currentIndex.set(filePath, newIndex);
    this.emit({ type: "history:undone", filePath });

    return entries[newIndex] ?? null;
  }

  redo(filePath: string): string | null {
    const entries = this.history.get(filePath);
    const index = this.currentIndex.get(filePath);

    if (!entries || index === undefined || index >= entries.length - 1) return null;

    const newIndex = index + 1;
    this.currentIndex.set(filePath, newIndex);
    this.emit({ type: "history:redone", filePath });

    return entries[newIndex] ?? null;
  }

  canUndo(filePath: string): boolean {
    const index = this.currentIndex.get(filePath);
    return index !== undefined && index > 0;
  }

  canRedo(filePath: string): boolean {
    const entries = this.history.get(filePath);
    const index = this.currentIndex.get(filePath);
    return entries !== undefined && index !== undefined && index < entries.length - 1;
  }

  computeDiff(filePath: string, oldContent: string, newContent: string): FileDiff {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    const fileName = filePath.split("/").pop() ?? filePath;

    const lines: DiffLine[] = [];
    let addedCount = 0;
    let removedCount = 0;
    let lineIndex = 0;

    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined) {
        lines.push({ type: "added", content: newLine!, lineNumber: ++lineIndex });
        addedCount++;
      } else if (newLine === undefined) {
        lines.push({ type: "removed", content: oldLine, lineNumber: 0 });
        removedCount++;
      } else if (oldLine !== newLine) {
        lines.push({ type: "removed", content: oldLine, lineNumber: 0 });
        lines.push({ type: "added", content: newLine, lineNumber: ++lineIndex });
        removedCount++;
        addedCount++;
      } else {
        lines.push({ type: "unchanged", content: oldLine, lineNumber: ++lineIndex });
      }
    }

    return { filePath, fileName, lines, addedCount, removedCount };
  }

  clearHistory(filePath: string): void {
    this.history.delete(filePath);
    this.currentIndex.delete(filePath);
  }

  subscribe(listener: UndoRedoListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(event: UndoRedoEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
