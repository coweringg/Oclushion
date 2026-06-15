import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  KeyboardShortcutsService,
  createDefaultShortcuts,
  type Shortcut,
} from "./keyboard-shortcuts.service";

class MockKeyboardEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  bubbles: boolean;
  type = "keydown";
  defaultPrevented = false;

  constructor(type: string, init: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean; bubbles?: boolean }) {
    this.key = init.key;
    this.ctrlKey = init.ctrlKey ?? false;
    this.metaKey = init.metaKey ?? false;
    this.shiftKey = init.shiftKey ?? false;
    this.altKey = init.altKey ?? false;
    this.bubbles = init.bubbles ?? false;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  stopPropagation(): void {}
}

if (typeof globalThis.KeyboardEvent === "undefined") {
  (globalThis as any).KeyboardEvent = MockKeyboardEvent;
}

describe("KeyboardShortcutsService", () => {
  let service: KeyboardShortcutsService;

  beforeEach(() => {
    service = new KeyboardShortcutsService();
  });

  it("registers a shortcut", () => {
    const shortcut: Shortcut = {
      key: "s",
      modifiers: ["mod"],
      action: "saveFile",
      description: "Save File",
      category: "file",
    };
    const handler = vi.fn();
    service.register(shortcut, handler);

    expect(service.getAll()).toHaveLength(1);
    expect(service.getByAction("saveFile")).toEqual(shortcut);
  });

  it("unregisters a shortcut by action", () => {
    const shortcut: Shortcut = {
      key: "s",
      modifiers: ["mod"],
      action: "saveFile",
      description: "Save File",
      category: "file",
    };
    service.register(shortcut, vi.fn());
    service.unregister("saveFile");

    expect(service.getAll()).toHaveLength(0);
  });

  it("gets shortcuts by category", () => {
    service.register(
      { key: "s", modifiers: ["mod"], action: "save", description: "Save", category: "file" },
      vi.fn(),
    );
    service.register(
      { key: "z", modifiers: ["mod"], action: "undo", description: "Undo", category: "edit" },
      vi.fn(),
    );
    service.register(
      { key: "b", modifiers: ["mod"], action: "toggleSidebar", description: "Toggle", category: "view" },
      vi.fn(),
    );

    expect(service.getByCategory("file")).toHaveLength(1);
    expect(service.getByCategory("edit")).toHaveLength(1);
    expect(service.getByCategory("view")).toHaveLength(1);
  });

  it("formats key display for Mac", () => {
    const shortcut: Shortcut = {
      key: "s",
      modifiers: ["mod"],
      action: "save",
      description: "Save",
      category: "file",
    };
    const result = service.formatKey(shortcut);
    expect(result).toMatch(/^(Cmd|Ctrl)\+s$/);
  });

  it("formats key with shift modifier", () => {
    const shortcut: Shortcut = {
      key: "z",
      modifiers: ["mod", "shift"],
      action: "redo",
      description: "Redo",
      category: "edit",
    };
    const result = service.formatKey(shortcut);
    expect(result).toContain("Shift");
    expect(result).toContain("z");
  });

  it("handles keyboard events", () => {
    const handler = vi.fn();
    service.register(
      { key: "s", modifiers: ["mod"], action: "save", description: "Save", category: "file" },
      handler,
    );

    const event = new MockKeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
    }) as unknown as KeyboardEvent;
    const handled = service.handleKeyDown(event);

    expect(handled).toBe(true);
    expect(handler).toHaveBeenCalled();
  });

  it("does not handle unregistered keys", () => {
    const handler = vi.fn();
    service.register(
      { key: "s", modifiers: ["mod"], action: "save", description: "Save", category: "file" },
      handler,
    );

    const event = new MockKeyboardEvent("keydown", {
      key: "x",
      ctrlKey: true,
      bubbles: true,
    }) as unknown as KeyboardEvent;
    const handled = service.handleKeyDown(event);

    expect(handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("emits events on register and execute", () => {
    const events: string[] = [];
    service.subscribe((event) => events.push(event.type));

    service.register(
      { key: "s", modifiers: ["mod"], action: "save", description: "Save", category: "file" },
      vi.fn(),
    );

    expect(events).toContain("shortcut:registered");
  });

  it("creates default shortcuts with correct count", () => {
    const defaults = createDefaultShortcuts();
    expect(defaults.length).toBeGreaterThanOrEqual(10);
  });

  it("all default shortcuts have required fields", () => {
    const defaults = createDefaultShortcuts();
    for (const shortcut of defaults) {
      expect(shortcut.key).toBeTruthy();
      expect(shortcut.modifiers.length).toBeGreaterThan(0);
      expect(shortcut.action).toBeTruthy();
      expect(shortcut.description).toBeTruthy();
      expect(shortcut.category).toBeTruthy();
    }
  });

  it("detects conflicts when registering same key", () => {
    const events: string[] = [];
    service.subscribe((event) => {
      if (event.type === "shortcut:conflict") events.push("conflict");
    });

    service.register(
      { key: "s", modifiers: ["mod"], action: "save1", description: "Save 1", category: "file" },
      vi.fn(),
    );
    service.register(
      { key: "s", modifiers: ["mod"], action: "save2", description: "Save 2", category: "file" },
      vi.fn(),
    );

    expect(events).toContain("conflict");
  });
});
