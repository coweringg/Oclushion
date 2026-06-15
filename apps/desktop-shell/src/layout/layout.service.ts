import { logger } from "../utils/logger";
import { z } from "zod";

export type PanelType = "editor" | "terminal" | "chat" | "kanban" | "preview" | "filetree" | "canvas";

export type Panel = {
  id: string;
  type: PanelType;
  title: string;
  filePath?: string;
  size: number;
  minSize: number;
  maximized: boolean;
  visible: boolean;
};

export type LayoutPreset = "coding" | "reviewing" | "planning" | "canvas-mode";

export type LayoutConfig = {
  panels: Panel[];
  direction: "horizontal" | "vertical";
};

export type LayoutEvent =
  | { type: "layout:changed" }
  | { type: "layout:panel_added"; panelId: string }
  | { type: "layout:panel_removed"; panelId: string }
  | { type: "layout:panel_resized"; panelId: string; size: number }
  | { type: "layout:panel_maximized"; panelId: string }
  | { type: "layout:preset_loaded"; preset: LayoutPreset };

export type LayoutListener = (event: LayoutEvent) => void;

const STORAGE_KEY = "ocl_layout_config";

const PRESETS: Record<LayoutPreset, LayoutConfig> = {
  coding: {
    panels: [
      { id: "filetree", type: "filetree", title: "Files", size: 200, minSize: 150, maximized: false, visible: true },
      { id: "editor", type: "editor", title: "Editor", size: 0, minSize: 300, maximized: false, visible: true },
      { id: "terminal", type: "terminal", title: "Terminal", size: 200, minSize: 100, maximized: false, visible: true },
    ],
    direction: "horizontal",
  },
  reviewing: {
    panels: [
      { id: "editor-left", type: "editor", title: "Original", size: 0, minSize: 300, maximized: false, visible: true },
      { id: "editor-right", type: "editor", title: "Changes", size: 0, minSize: 300, maximized: false, visible: true },
      { id: "chat", type: "chat", title: "AI Chat", size: 300, minSize: 250, maximized: false, visible: true },
    ],
    direction: "horizontal",
  },
  planning: {
    panels: [
      { id: "kanban", type: "kanban", title: "Tasks", size: 0, minSize: 400, maximized: false, visible: true },
      { id: "chat", type: "chat", title: "AI Chat", size: 350, minSize: 250, maximized: false, visible: true },
    ],
    direction: "horizontal",
  },
  "canvas-mode": {
    panels: [
      { id: "canvas-main", type: "canvas", title: "Oclushion Canvas", size: 0, minSize: 800, maximized: true, visible: true },
      { id: "terminal", type: "terminal", title: "Terminal", size: 250, minSize: 100, maximized: false, visible: true },
    ],
    direction: "vertical",
  },
};

export class LayoutService {
  private panels: Panel[] = [];
  private direction: "horizontal" | "vertical" = "horizontal";
  private listeners = new Set<LayoutListener>();
  private panelCounter = 0;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
  }

  getPanels(): Panel[] {
    return this.panels.filter((p) => p.visible);
  }

  getAllPanels(): Panel[] {
    return [...this.panels];
  }

  addPanel(type: PanelType, title: string): Panel {
    this.panelCounter++;
    const panel: Panel = {
      id: `${type}-${this.panelCounter}`,
      type,
      title,
      size: 250,
      minSize: 150,
      maximized: false,
      visible: true,
    };
    this.panels.push(panel);
    this.save();
    this.emit({ type: "layout:panel_added", panelId: panel.id });
    this.emit({ type: "layout:changed" });
    return panel;
  }

  removePanel(panelId: string): void {
    if (this.panels.length <= 1) return;
    this.panels = this.panels.filter((p) => p.id !== panelId);
    this.save();
    this.emit({ type: "layout:panel_removed", panelId });
    this.emit({ type: "layout:changed" });
  }

  togglePanel(panelId: string): void {
    const panel = this.panels.find((p) => p.id === panelId);
    if (panel) {
      panel.visible = !panel.visible;
      this.save();
      this.emit({ type: "layout:changed" });
    }
  }

  resizePanel(panelId: string, size: number): void {
    const panel = this.panels.find((p) => p.id === panelId);
    if (panel) {
      panel.size = Math.max(panel.minSize, size);
      this.debouncedSave();
      this.emit({ type: "layout:panel_resized", panelId, size: panel.size });
      this.emit({ type: "layout:changed" });
    }
  }

  maximizePanel(panelId: string): void {
    const panel = this.panels.find((p) => p.id === panelId);
    if (panel) {
      panel.maximized = !panel.maximized;
      this.save();
      this.emit({ type: "layout:panel_maximized", panelId });
      this.emit({ type: "layout:changed" });
    }
  }

  loadPreset(preset: LayoutPreset): void {
    const config = PRESETS[preset];
    if (config) {
      this.panels = config.panels.map((p) => ({ ...p }));
      this.direction = config.direction;
      this.save();
      this.emit({ type: "layout:preset_loaded", preset });
      this.emit({ type: "layout:changed" });
    }
  }

  getDirection(): "horizontal" | "vertical" {
    return this.direction;
  }

  setDirection(direction: "horizontal" | "vertical"): void {
    this.direction = direction;
    this.save();
    this.emit({ type: "layout:changed" });
  }

  subscribe(listener: LayoutListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  destroy(): void {
    this.listeners.clear();
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
  }

  private debouncedSave(): void {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.save();
      this.saveDebounceTimer = null;
    }, 300);
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = z.object({
          panels: z.array(z.unknown()),
          direction: z.enum(["horizontal", "vertical"]),
        }).safeParse(JSON.parse(stored));
        
        if (parsed.success) {
          const config = parsed.data as unknown as LayoutConfig;
          this.panels = config.panels.filter(
            (p: Panel) => p && typeof p === "object" && typeof p.id === "string" && typeof p.type === "string" && typeof p.size === "number",
          );
          this.direction = config.direction;
          return;
        }
      }
    } catch (error) {
      logger.debug('LayoutService', 'Failed to load layout from localStorage', error);
    }
    this.loadPreset("coding");
  }

  private save(): void {
    try {
      const config: LayoutConfig = { panels: this.panels, direction: this.direction };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      logger.debug('LayoutService', 'Failed to save layout to localStorage', error);
    }
  }

  private emit(event: LayoutEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
