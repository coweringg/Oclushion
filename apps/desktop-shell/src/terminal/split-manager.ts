import type { SplitPane, SplitDirection, SplitLayout } from "./terminal.types";
import { SPLIT_STORAGE_KEY } from "./terminal.types";

export class SplitManager {
  private layout: SplitLayout;

  public constructor(private readonly initialSessionIds: string[] = []) {
    this.layout = this.load() ?? this.createDefaultLayout(initialSessionIds);
  }

  public getLayout(): SplitLayout {
    return this.layout;
  }

  public getSessionIds(): string[] {
    return this.collectLeafSessionIds(this.layout.root).filter((id) => id !== "");
  }

  public splitPane(parentSessionId: string, newSessionId: string, direction: SplitDirection): void {
    const result = this.findParentAndIndex(this.layout.root, parentSessionId);
    if (!result) {
      this.addToRoot(newSessionId, direction);
      return;
    }
    const { pane, parent, index } = result;
    if (parent.direction === direction) {
      parent.children.splice(index + 1, 0, this.createLeaf(newSessionId));
    } else {
      const replaced: SplitPane = {
        kind: "split",
        direction,
        children: [
          { ...pane, size: 1 },
          this.createLeaf(newSessionId),
        ],
        size: pane.size,
      };
      parent.children[index] = replaced;
    }
    this.save();
  }

  public closePane(sessionId: string): void {
    const result = this.findParentAndIndex(this.layout.root, sessionId);
    if (!result) return;
    const { parent, index } = result;
    parent.children.splice(index, 1);
    if (parent.children.length === 0) {
      this.replaceSplitNode(parent, null);
    } else if (parent.children.length === 1) {
      this.replaceSplitNode(parent, parent.children[0]!);
    }
    this.save();
  }

  private static readonly MIN_PANE_RATIO = 0.1;

  public resizePane(sessionId: string, delta: number): void {
    const result = this.findParentAndIndex(this.layout.root, sessionId);
    if (!result) return;
    const { parent, index } = result;
    if (index > 0) {
      const prev = parent.children[index - 1]!;
      const rawPrev = Math.max(SplitManager.MIN_PANE_RATIO, prev.size + delta);
      const rawCurrent = Math.max(SplitManager.MIN_PANE_RATIO, parent.children[index]!.size - delta);
      const total = rawPrev + rawCurrent;
      prev.size = Math.max(SplitManager.MIN_PANE_RATIO, Math.min(1 - SplitManager.MIN_PANE_RATIO, rawPrev / total));
      parent.children[index]!.size = 1 - prev.size;
    } else if (index < parent.children.length - 1) {
      const next = parent.children[index + 1]!;
      const rawCurrent = Math.max(SplitManager.MIN_PANE_RATIO, parent.children[index]!.size + delta);
      const rawNext = Math.max(SplitManager.MIN_PANE_RATIO, next.size - delta);
      const total = rawCurrent + rawNext;
      parent.children[index]!.size = Math.max(SplitManager.MIN_PANE_RATIO, Math.min(1 - SplitManager.MIN_PANE_RATIO, rawCurrent / total));
      next.size = 1 - parent.children[index]!.size;
    }
    this.save();
  }

  public getActivePaneCount(): number {
    return this.collectLeafSessionIds(this.layout.root).length;
  }

  public async persist(): Promise<void> {
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, JSON.stringify(this.layout));
    } catch {
      console.warn("SplitManager: Failed to persist layout");
    }
  }

  private load(): SplitLayout | null {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SplitLayout;
    } catch {
      return null;
    }
  }

  private save(): void {
    void this.persist();
  }

  private createDefaultLayout(sessionIds: string[]): SplitLayout {
    return {
      root: this.createLeaf(sessionIds[0] ?? ""),
      sizes: {},
    };
  }

  private createLeaf(sessionId: string): SplitPane {
    return { kind: "leaf", sessionId, size: 1 };
  }

  private collectLeafSessionIds(pane: SplitPane): string[] {
    if (pane.kind === "leaf") return [pane.sessionId];
    if (pane.kind === "split") return pane.children.flatMap((child) => this.collectLeafSessionIds(child));
    return [];
  }

  private findParentAndIndex(
    pane: SplitPane,
    targetSessionId: string,
    parent?: SplitPane & { kind: "split" },
    index?: number,
  ): { pane: SplitPane; parent: SplitPane & { kind: "split" }; index: number } | null {
    if (pane.kind === "leaf" && pane.sessionId === targetSessionId) {
      if (parent === undefined) return null;
      return { pane, parent, index: index! };
    }
    if (pane.kind === "split") {
      for (let i = 0; i < pane.children.length; i++) {
        const result = this.findParentAndIndex(pane.children[i]!, targetSessionId, pane, i);
        if (result) return result;
      }
    }
    return null;
  }

  private addToRoot(newSessionId: string, direction: SplitDirection): void {
    if (this.layout.root.kind === "leaf" && !this.layout.root.sessionId) {
      this.layout.root.sessionId = newSessionId;
    } else {
      this.layout.root = {
        kind: "split",
        direction,
        children: [this.layout.root, this.createLeaf(newSessionId)],
        size: 1,
      };
    }
  }

  private replaceSplitNode(target: SplitPane & { kind: "split" }, replacement: SplitPane | null): void {
    if (target === this.layout.root) {
      if (replacement) {
        replacement.size = 1;
        this.layout.root = replacement;
      } else {
        this.layout.root = this.createLeaf("");
      }
      return;
    }
    const gpResult = this.findParentOfSplit(this.layout.root, target);
    if (!gpResult) return;
    const { parent: grandparent, index } = gpResult;
    if (replacement) {
      replacement.size = target.size;
      grandparent.children[index] = replacement;
    } else {
      grandparent.children.splice(index, 1);
      if (grandparent.children.length === 1) {
        this.replaceSplitNode(grandparent, grandparent.children[0]!);
      } else if (grandparent.children.length === 0) {
        this.replaceSplitNode(grandparent, null);
      }
    }
  }

  private findParentOfSplit(
    pane: SplitPane,
    target: SplitPane & { kind: "split" },
  ): { parent: SplitPane & { kind: "split" }; index: number } | null {
    if (pane.kind === "split") {
      for (let i = 0; i < pane.children.length; i++) {
        const child = pane.children[i]!;
        if (child === target) {
          return { parent: pane, index: i };
        }
        const result = this.findParentOfSplit(child, target);
        if (result) return result;
      }
    }
    return null;
  }
}
