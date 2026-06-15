import { describe, it, expect, beforeEach, vi } from "vitest";
import { LayoutService } from "./layout.service";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

describe("LayoutService", () => {
  let service: LayoutService;

  beforeEach(() => {
    localStorageMock.clear();
    service = new LayoutService();
  });

  it("loads default coding preset", () => {
    const panels = service.getPanels();
    expect(panels.length).toBe(3);
    expect(panels.some((p) => p.type === "editor")).toBe(true);
    expect(panels.some((p) => p.type === "terminal")).toBe(true);
    expect(panels.some((p) => p.type === "filetree")).toBe(true);
  });

  it("adds a new panel", () => {
    const panel = service.addPanel("chat", "AI Chat");
    expect(service.getPanels().length).toBe(4);
    expect(panel.type).toBe("chat");
    expect(panel.visible).toBe(true);
  });

  it("removes a panel", () => {
    const panels = service.getPanels();
    const panelToRemove = panels[1];
    if (panelToRemove) {
      service.removePanel(panelToRemove.id);
      expect(service.getPanels().length).toBe(2);
    }
  });

  it("does not remove last panel", () => {
    const panels = service.getPanels();
    for (const p of panels) {
      service.removePanel(p.id);
    }
    expect(service.getPanels().length).toBe(1);
  });

  it("toggles panel visibility", () => {
    const panels = service.getPanels();
    const panel = panels[0];
    if (panel) {
      service.togglePanel(panel.id);
      expect(service.getPanels().find((p) => p.id === panel.id)).toBeUndefined();
      service.togglePanel(panel.id);
      expect(service.getPanels().find((p) => p.id === panel.id)).toBeDefined();
    }
  });

  it("respects min size when resizing", () => {
    const panels = service.getPanels();
    const panel = panels[0];
    if (panel) {
      service.resizePanel(panel.id, 50);
      expect(panel.size).toBe(panel.minSize);
    }
  });

  it("maximizes a panel", () => {
    const panels = service.getPanels();
    const panel = panels[0];
    if (panel) {
      service.maximizePanel(panel.id);
      expect(panel.maximized).toBe(true);
    }
  });

  it("loads reviewing preset", () => {
    service.loadPreset("reviewing");
    const panels = service.getPanels();
    expect(panels.some((p) => p.type === "chat")).toBe(true);
  });

  it("loads planning preset", () => {
    service.loadPreset("planning");
    const panels = service.getPanels();
    expect(panels.some((p) => p.type === "kanban")).toBe(true);
  });

  it("persists layout to localStorage", () => {
    service.addPanel("preview", "Preview");
    const newService = new LayoutService();
    expect(newService.getPanels().length).toBe(4);
  });

  it("toggles direction", () => {
    const initial = service.getDirection();
    service.setDirection(initial === "horizontal" ? "vertical" : "horizontal");
    expect(service.getDirection()).not.toBe(initial);
  });
});
