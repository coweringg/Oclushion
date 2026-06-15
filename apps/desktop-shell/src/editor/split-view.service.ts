export type SplitDirection = "horizontal" | "vertical";

export type SplitPane = {
  id: string;
  filePath: string | null;
  active: boolean;
};

export type SplitViewEvent =
  | { type: "split:created"; id: string; direction: SplitDirection }
  | { type: "split:closed"; id: string }
  | { type: "split:active"; id: string }
  | { type: "split:direction"; id: string; direction: SplitDirection };

export type SplitViewListener = (event: SplitViewEvent) => void;

export class SplitViewService {
  private panes: SplitPane[] = [{ id: "main", filePath: null, active: true }];
  private direction: SplitDirection = "horizontal";
  private listeners = new Set<SplitViewListener>();

  private paneCounter = 0;

  split(direction: SplitDirection = "horizontal"): SplitPane {
    this.paneCounter++;
    const newPane: SplitPane = {
      id: `pane-${this.paneCounter}`,
      filePath: null,
      active: false,
    };
    this.panes.push(newPane);
    this.direction = direction;
    this.emit({ type: "split:created", id: newPane.id, direction });
    return newPane;
  }

  closePane(id: string): void {
    if (this.panes.length <= 1) return;
    this.panes = this.panes.filter((pane) => pane.id !== id);
    if (this.panes.length > 0 && !this.panes.some((p) => p.active)) {
      this.panes[0]!.active = true;
    }
    this.emit({ type: "split:closed", id });
  }

  setActivePane(id: string): void {
    for (const pane of this.panes) {
      pane.active = pane.id === id;
    }
    this.emit({ type: "split:active", id });
  }

  openFileInPane(paneId: string, filePath: string): void {
    const pane = this.panes.find((p) => p.id === paneId);
    if (pane) {
      pane.filePath = filePath;
    }
  }

  getPanes(): SplitPane[] {
    return [...this.panes];
  }

  getDirection(): SplitDirection {
    return this.direction;
  }

  getPaneCount(): number {
    return this.panes.length;
  }

  getActivePane(): SplitPane | undefined {
    return this.panes.find((p) => p.active);
  }

  toggleDirection(): void {
    this.direction = this.direction === "horizontal" ? "vertical" : "horizontal";
    this.emit({ type: "split:direction", id: "main", direction: this.direction });
  }

  subscribe(listener: SplitViewListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: SplitViewEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
