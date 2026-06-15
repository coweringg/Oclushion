import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "./workspace.service";

const mockStorage = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, val: string) => { mockStorage.set(key, val); },
  removeItem: (key: string) => { mockStorage.delete(key); },
  clear: () => { mockStorage.clear(); },
  get length() { return mockStorage.size; },
  key: (i: number) => [...mockStorage.keys()][i] ?? null,
});

function fakeWorkspace(overrides?: Partial<Parameters<WorkspaceService["add"]>[0]>) {
  return {
    name: "Test Workspace",
    rootPath: "/home/test",
    settings: { llmProvider: "ollama" },
    ...overrides,
  };
}

describe("WorkspaceService", () => {
  let service: WorkspaceService;

  beforeEach(() => {
    mockStorage.clear();
    service = new WorkspaceService();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  it("starts with no workspaces", () => {
    expect(service.list()).toHaveLength(0);
    expect(service.getActive()).toBeNull();
  });

  it("adds a workspace", () => {
    const ws = service.add(fakeWorkspace());
    expect(ws.id).toBeDefined();
    expect(ws.name).toBe("Test Workspace");
    expect(ws.createdAt).toBeDefined();
    expect(service.list()).toHaveLength(1);
  });

  it("retrieves a workspace by id", () => {
    const ws = service.add(fakeWorkspace());
    expect(service.get(ws.id)?.name).toBe("Test Workspace");
    expect(service.get("nonexistent")).toBeNull();
  });

  it("updates a workspace", () => {
    const ws = service.add(fakeWorkspace());
    const updated = service.update(ws.id, { name: "Updated" });
    expect(updated?.name).toBe("Updated");
    expect(service.get(ws.id)?.name).toBe("Updated");
  });

  it("returns null when updating a nonexistent workspace", () => {
    expect(service.update("bad-id", { name: "Nope" })).toBeNull();
  });

  it("removes a workspace", () => {
    const ws = service.add(fakeWorkspace());
    expect(service.remove(ws.id)).toBe(true);
    expect(service.list()).toHaveLength(0);
  });

  it("returns false when removing a nonexistent workspace", () => {
    expect(service.remove("bad-id")).toBe(false);
  });

  it("sets and gets active workspace", () => {
    const ws = service.add(fakeWorkspace());
    expect(service.setActive(ws.id)).toBe(true);
    expect(service.getActive()?.id).toBe(ws.id);
  });

  it("returns false when setting active to nonexistent id", () => {
    expect(service.setActive("bad-id")).toBe(false);
  });

  it("persists to localStorage", () => {
    const ws = service.add(fakeWorkspace());
    service.setActive(ws.id);

    const service2 = new WorkspaceService();
    expect(service2.list()).toHaveLength(1);
    expect(service2.getActive()?.id).toBe(ws.id);
  });

  it("falls back to first workspace when active is removed", () => {
    const ws1 = service.add(fakeWorkspace({ name: "First" }));
    const ws2 = service.add(fakeWorkspace({ name: "Second" }));
    service.setActive(ws1.id);
    service.remove(ws1.id);
    expect(service.getActive()?.id).toBe(ws2.id);
  });
});
