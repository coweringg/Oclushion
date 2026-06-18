import type { DiffLine } from "./editor.types";

export type DiffHunk = {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  accepted: boolean | null;
};

export class DiffInlineService {
  computeDiff(original: string, current: string): DiffLine[] {
    const originalLines = original.split("\n");
    const currentLines = current.split("\n");
    const result: DiffLine[] = [];

    const maxLines = Math.max(originalLines.length, currentLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const currLine = currentLines[i];

      if (origLine === undefined) {
        result.push({ type: "added", content: currLine ?? "", lineNumber: i + 1 });
      } else if (currLine === undefined) {
        result.push({ type: "removed", content: origLine, lineNumber: i + 1 });
      } else if (origLine === currLine) {
        result.push({ type: "unchanged", content: currLine, lineNumber: i + 1 });
      } else {
        result.push({ type: "removed", content: origLine, lineNumber: i + 1 });
        result.push({ type: "added", content: currLine, lineNumber: i + 1 });
      }
    }

    return result;
  }

  getAddedLines(diff: DiffLine[]): number[] {
    return diff.filter((line) => line.type === "added").map((line) => line.lineNumber);
  }

  getRemovedLines(diff: DiffLine[]): number[] {
    return diff.filter((line) => line.type === "removed").map((line) => line.lineNumber);
  }

  hasChanges(diff: DiffLine[]): boolean {
    return diff.some((line) => line.type !== "unchanged");
  }

  computeHunks(diff: DiffLine[]): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;

    for (let i = 0; i < diff.length; i++) {
      const line = diff[i];
      
      if (line.type === "unchanged") {
        if (currentHunk) {
          hunks.push(currentHunk);
          currentHunk = null;
        }
        continue;
      }

      if (!currentHunk) {
        currentHunk = {
          id: `hunk-${hunks.length}`,
          oldStart: line.lineNumber,
          oldLines: 0,
          newStart: line.lineNumber,
          newLines: 0,
          lines: [],
          accepted: null,
        };
      }

      currentHunk.lines.push(line);
      if (line.type === "removed") {
        currentHunk.oldLines++;
      } else if (line.type === "added") {
        currentHunk.newLines++;
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  applyHunk(original: string, hunk: DiffHunk): string {
    const lines = original.split("\n");
    const startIdx = hunk.oldStart - 1;
    
    const removedCount = hunk.lines.filter((l) => l.type === "removed").length;
    lines.splice(startIdx, removedCount);

    const addedLines = hunk.lines.filter((l) => l.type === "added").map((l) => l.content);
    lines.splice(startIdx, 0, ...addedLines);

    return lines.join("\n");
  }

  rejectHunk(original: string, _hunk: DiffHunk): string {
    return original;
  }

  revertToOriginal(current: string, original: string): string {
    return original;
  }
}
