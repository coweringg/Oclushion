import { logger } from "../utils/logger";
import type { KeyValueStore } from "../persistent-store";
import type { LayoutMode, PanelLayout, SpatialLayoutState, CanvasPanelNodeData } from "./canvas.types";

const SPATIAL_LAYOUT_KEY = "ocl_spatial_layout";

const DEFAULT_PANELS: PanelLayout[] = [
  { panelId: "editor", x: 80, y: 40, width: 520, height: 360, minimized: false },
  { panelId: "chat", x: 640, y: 40, width: 320, height: 400, minimized: false },
  { panelId: "terminal", x: 80, y: 420, width: 520, height: 200, minimized: false },
  { panelId: "repo-tree", x: 640, y: 460, width: 320, height: 240, minimized: false },
  { panelId: "safe-diff", x: 0, y: 0, width: 0, height: 0, minimized: true },
];

export class SpatialLayoutService {
  private layoutMode: LayoutMode = "fixed";
  private panels: PanelLayout[] = [...DEFAULT_PANELS];
  private viewport = { x: 0, y: 0, zoom: 1 };
  private listeners = new Set<() => void>();
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly kvStore: KeyValueStore) {
    void this.loadState();
  }

  public getMode(): LayoutMode {
    return this.layoutMode;
  }

  public setMode(mode: LayoutMode): void {
    if (this.layoutMode === mode) return;
    this.layoutMode = mode;
    this.emitAndSave();
  }

  public toggleMode(): void {
    this.layoutMode = this.layoutMode === "fixed" ? "canvas" : "fixed";
    this.emitAndSave();
  }

  public getPanels(): PanelLayout[] {
    return [...this.panels];
  }

  public getVisiblePanels(): PanelLayout[] {
    return this.panels.filter((p) => !p.minimized);
  }

  public getPanel(panelId: CanvasPanelNodeData["panelId"]): PanelLayout | undefined {
    return this.panels.find((p) => p.panelId === panelId);
  }

  public updatePanel(panelId: CanvasPanelNodeData["panelId"], updates: Partial<PanelLayout>): void {
    const index = this.panels.findIndex((p) => p.panelId === panelId);
    if (index === -1) return;
    this.panels[index] = { ...this.panels[index], ...updates } as PanelLayout;
    this.emitAndSave();
  }

  public toggleMinimize(panelId: CanvasPanelNodeData["panelId"]): void {
    const panel = this.panels.find((p) => p.panelId === panelId);
    if (!panel) return;
    panel.minimized = !panel.minimized;
    this.emitAndSave();
  }

  public setViewport(viewport: { x: number; y: number; zoom: number }): void {
    this.viewport = viewport;
    this.debouncedSave();
  }

  public resetLayout(): void {
    this.panels = DEFAULT_PANELS.map((p) => ({ ...p }));
    this.viewport = { x: 0, y: 0, zoom: 1 };
    this.emitAndSave();
  }

  public autoLayout(): void {
    let x = 40;
    let y = 40;
    this.panels = this.panels.map((p) => {
      const layout = { ...p, x, y };
      x += p.width + 20;
      if (x + p.width > 1000) {
        x = 40;
        y += p.height + 20;
      }
      return layout;
    });
    this.emitAndSave();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitAndSave(): void {
    for (const listener of this.listeners) listener();
    this.debouncedSave();
  }

  private debouncedSave(): void {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveState();
      this.saveDebounceTimer = null;
    }, 500);
  }

  private async saveState(): Promise<void> {
    try {
      const state: SpatialLayoutState = {
        panels: this.panels,
        viewport: this.viewport,
      };
      await this.kvStore.setItem(SPATIAL_LAYOUT_KEY, JSON.stringify(state));
    } catch (err) {
      logger.warn("SpatialLayoutService", "Failed to save layout state", err);
    }
  }

  private async loadState(): Promise<void> {
    try {
      const raw = await this.kvStore.getItem(SPATIAL_LAYOUT_KEY);
      if (raw) {
        const state = JSON.parse(raw) as SpatialLayoutState;
        if (state.panels?.length) {
          this.panels = state.panels;
        }
        if (state.viewport) {
          this.viewport = state.viewport;
        }
        for (const listener of this.listeners) listener();
      }
    } catch (err) {
      logger.warn("SpatialLayoutService", "Failed to load layout state", err);
    }
  }
}
