import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { SplitManager } from "./split-manager";
import { SPLIT_STORAGE_KEY } from "./terminal.types";

function mockLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    get length() { return store.size; },
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
  });
}

describe("SplitManager", () => {
  let manager: SplitManager;

  beforeEach(() => {
    mockLocalStorage();
    manager = new SplitManager(["session-1"]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with a single session", () => {
    expect(manager.getSessionIds()).toEqual(["session-1"]);
    expect(manager.getActivePaneCount()).toBe(1);
  });

  it("provides default layout for no initial sessions", () => {
    const empty = new SplitManager();
    expect(empty.getActivePaneCount()).toBe(1);
    expect(empty.getSessionIds()).toEqual([]);
  });

  it("splits horizontally and tracks both sessions", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    const ids = manager.getSessionIds();
    expect(ids).toContain("session-1");
    expect(ids).toContain("session-2");
    expect(ids.length).toBe(2);
    expect(manager.getActivePaneCount()).toBe(2);
  });

  it("splits vertically and tracks sessions", () => {
    manager.splitPane("session-1", "session-2", "vertical");
    const ids = manager.getSessionIds();
    expect(ids).toContain("session-1");
    expect(ids).toContain("session-2");
    expect(ids.length).toBe(2);
  });

  it("splits existing pane into multiple directions", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.splitPane("session-1", "session-3", "vertical");
    const ids = manager.getSessionIds();
    expect(ids).toContain("session-1");
    expect(ids).toContain("session-2");
    expect(ids).toContain("session-3");
    expect(ids.length).toBe(3);
  });

  it("adds sibling to same-direction split without nesting", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.splitPane("session-1", "session-3", "horizontal");
    const layout = manager.getLayout();
    expect(layout.root.kind).toBe("split");
    if (layout.root.kind === "split") {
      expect(layout.root.direction).toBe("horizontal");
      expect(layout.root.children.length).toBe(3);
    }
  });

  it("closes a pane and removes it from layout", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    expect(manager.getActivePaneCount()).toBe(2);
    manager.closePane("session-2");
    expect(manager.getActivePaneCount()).toBe(1);
    expect(manager.getSessionIds()).toContain("session-1");
  });

  it("collapses to leaf when closing leaves one pane", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.closePane("session-2");
    const layout = manager.getLayout();
    expect(layout.root.kind).toBe("leaf");
    if (layout.root.kind === "leaf") {
      expect(layout.root.sessionId).toBe("session-1");
    }
  });

  it("handles closing empty session gracefully", () => {
    manager.closePane("non-existent");
    expect(manager.getSessionIds()).toEqual(["session-1"]);
  });

  it("maintains structural integrity after multiple close operations", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.splitPane("session-1", "session-3", "vertical");
    manager.closePane("session-3");
    const ids = manager.getSessionIds();
    expect(ids).toContain("session-1");
    expect(ids).toContain("session-2");
    expect(ids.length).toBe(2);
  });

  it("resizes a pane adjusting sizes proportionally", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    const layout = manager.getLayout();
    expect(layout.root.kind).toBe("split");
    if (layout.root.kind === "split") {
      const initialSize1 = layout.root.children[0]!.size;
      const initialSize2 = layout.root.children[1]!.size;
      manager.resizePane("session-1", 0.1);
      const updated = manager.getLayout();
      if (updated.root.kind === "split") {
        expect(updated.root.children[0]!.size).not.toBe(initialSize1);
        expect(initialSize1 + initialSize2).toBeCloseTo(2, 1);
      }
    }
  });

  it("resize works with negative delta", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.resizePane("session-1", -0.1);
    const layout = manager.getLayout();
    if (layout.root.kind === "split") {
      expect(layout.root.children[0]!.size).toBeGreaterThanOrEqual(0.1);
      expect(layout.root.children[1]!.size).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("resize clamps to minimum 0.1 ratio", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.resizePane("session-1", -10);
    const layout = manager.getLayout();
    if (layout.root.kind === "split") {
      expect(layout.root.children[0]!.size).toBeGreaterThanOrEqual(0.1);
      expect(layout.root.children[1]!.size).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("normalizes sizes after resize neighbors", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.splitPane("session-2", "session-3", "vertical");
    manager.resizePane("session-2", 0.1);
    const layout = manager.getLayout();
    if (layout.root.kind === "split") {
      const total = layout.root.children.reduce((sum, c) => sum + c.size, 0);
      expect(total).toBeCloseTo(2, 1);
    }
  });

  it("persists and restores layout via localStorage", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    void manager.persist();
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw);
      expect(parsed.root.kind).toBe("split");
      expect(parsed.root.direction).toBe("horizontal");
    }
  });

  it("restores layout from localStorage on creation", () => {
    const saved = {
      root: { kind: "split" as const, direction: "vertical" as const, children: [
        { kind: "leaf" as const, sessionId: "restored-1", size: 1 },
        { kind: "leaf" as const, sessionId: "restored-2", size: 1 },
      ], size: 1 },
      sizes: {},
    };
    localStorage.setItem(SPLIT_STORAGE_KEY, JSON.stringify(saved));
    const restored = new SplitManager();
    expect(restored.getSessionIds()).toContain("restored-1");
    expect(restored.getSessionIds()).toContain("restored-2");
    expect(restored.getSessionIds().length).toBe(2);
    localStorage.removeItem(SPLIT_STORAGE_KEY);
  });

  it("handles nested split structure correctly", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.splitPane("session-1", "session-3", "vertical");
    manager.splitPane("session-3", "session-4", "horizontal");
    const ids = manager.getSessionIds();
    expect(ids.length).toBe(4);
    expect(ids).toContain("session-4");
  });

  it("adding to empty root replace placeholder", () => {
    const empty = new SplitManager();
    empty.splitPane("", "new-session", "horizontal");
    expect(empty.getSessionIds()).toContain("new-session");
  });

  it("closePane collapses split correctly", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.splitPane("session-1", "session-3", "vertical");
    manager.closePane("session-2");
    const sessionIds = manager.getSessionIds();
    expect(sessionIds).toContain("session-1");
    expect(sessionIds).toContain("session-3");
    expect(sessionIds.length).toBe(2);
  });

  it("getActivePaneCount matches getSessionIds length", () => {
    manager.splitPane("session-1", "session-2", "horizontal");
    manager.splitPane("session-1", "session-3", "vertical");
    expect(manager.getActivePaneCount()).toBe(manager.getSessionIds().length);
    manager.closePane("session-3");
    expect(manager.getActivePaneCount()).toBe(manager.getSessionIds().length);
  });
});
