import { describe, expect, it, vi } from "vitest";

import { MCPRegistry, defaultMcpServers } from "./mcp-registry";

function createMockStore() {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn(async (key: string) => data.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { data.delete(key); }),
  };
}

describe("MCPRegistry", () => {
  it("loads default servers when store is empty", async () => {
    const store = createMockStore();
    const registry = await MCPRegistry.create(store as never);
    const list = registry.list();
    expect(list).toHaveLength(defaultMcpServers.length);
    expect(list.map((s) => s.id)).toEqual(defaultMcpServers.map((s) => s.id));
  });

  it("masks apiToken in list output", async () => {
    const store = createMockStore();
    const registry = await MCPRegistry.create(store as never);
    await registry.configure({ id: "github", name: "GitHub", enabled: true, baseUrl: "", apiToken: "secret-token" });
    const list = registry.list();
    const github = list.find((s) => s.id === "github");
    expect(github?.apiToken).toBe("********");
  });

  it("returns full config with token in get()", async () => {
    const store = createMockStore();
    const registry = await MCPRegistry.create(store as never);
    await registry.configure({ id: "github", name: "GitHub", enabled: true, baseUrl: "", apiToken: "secret" });
    const github = registry.get("github");
    expect(github.apiToken).toBe("secret");
  });

  it("throws for unknown provider", async () => {
    const store = createMockStore();
    const registry = await MCPRegistry.create(store as never);
    expect(() => registry.get("unknown" as never)).toThrow("Unknown MCP server: unknown");
  });

  it("persists configuration changes", async () => {
    const store = createMockStore();
    const registry = await MCPRegistry.create(store as never);
    await registry.configure({ id: "linear", name: "Linear", enabled: true, baseUrl: "", apiToken: "tok" });
    expect(store.setItem).toHaveBeenCalled();
  });

  it("loads persisted config from store", async () => {
    const store = createMockStore();
    const saved = defaultMcpServers.map((s) => ({ ...s, enabled: s.id === "github", apiToken: s.id === "github" ? "saved-tok" : "" }));
    (store.getItem as ReturnType<typeof vi.fn>).mockResolvedValueOnce(JSON.stringify(saved));

    const registry = await MCPRegistry.create(store as never);
    const github = registry.get("github");
    expect(github.enabled).toBe(true);
    expect(github.apiToken).toBe("saved-tok");
  });

  it("handles corrupt JSON in store gracefully", async () => {
    const store = createMockStore();
    (store.getItem as ReturnType<typeof vi.fn>).mockResolvedValueOnce("{broken");
    const registry = await MCPRegistry.create(store as never);
    expect(registry.list()).toHaveLength(defaultMcpServers.length);
    expect(store.removeItem).toHaveBeenCalled();
  });
});
