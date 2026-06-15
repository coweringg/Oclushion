import { describe, expect, it, vi } from "vitest";

import { MCPClient } from "./mcp-client";

function createMockRegistry(configs: Record<string, { enabled: boolean; apiToken: string }> = {}) {
  const get = vi.fn((id: string) => ({
    id,
    enabled: configs[id]?.enabled ?? false,
    apiToken: configs[id]?.apiToken ?? "",
    baseUrl: "",
    name: id,
  }));
  return {
    get,
    getWithToken: vi.fn(async (id: string) => get(id)),
  };
}

describe("MCPClient", () => {
  it("returns null when provider is disabled", async () => {
    const registry = createMockRegistry({ github: { enabled: false, apiToken: "tok" } });
    const client = new MCPClient(registry as never);
    const result = await client.fetchReference({ provider: "github", type: "issue", id: "1", url: "" });
    expect(result).toBeNull();
  });

  it("returns null when apiToken is empty", async () => {
    const registry = createMockRegistry({ github: { enabled: true, apiToken: "" } });
    const client = new MCPClient(registry as never);
    const result = await client.fetchReference({ provider: "github", type: "issue", id: "1", url: "" });
    expect(result).toBeNull();
  });

  it("fetches GitHub issue and maps fields", async () => {
    const registry = createMockRegistry({ github: { enabled: true, apiToken: "tok" } });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ title: "Bug", body: "Details", html_url: "https://github.com/o/r/issues/1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new MCPClient(registry as never);
    const result = await client.fetchReference({
      provider: "github",
      type: "issue",
      id: "1",
      url: "https://github.com/o/r/issues/1",
    });

    expect(result).toEqual({ provider: "github", id: "1", title: "Bug", content: "Details", url: "https://github.com/o/r/issues/1" });
    vi.unstubAllGlobals();
  });

  it("throws on invalid GitHub URL", async () => {
    const registry = createMockRegistry({ github: { enabled: true, apiToken: "tok" } });
    const client = new MCPClient(registry as never);
    await expect(
      client.fetchReference({ provider: "github", type: "issue", id: "1", url: "not-a-url" }),
    ).rejects.toThrow("Invalid GitHub reference");
  });

  it("fetches Linear issue via GraphQL", async () => {
    const registry = createMockRegistry({ linear: { enabled: true, apiToken: "tok" } });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { issue: { identifier: "ENG-1", title: "Task", description: "Do it", url: "https://linear.app/eng/ENG-1" } } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new MCPClient(registry as never);
    const result = await client.fetchReference({ provider: "linear", type: "ticket", id: "ENG-1", url: "" });

    expect(result?.title).toBe("Task");
    expect(result?.id).toBe("ENG-1");
    vi.unstubAllGlobals();
  });

  it("fetches Notion page and extracts title", async () => {
    const registry = createMockRegistry({ notion: { enabled: true, apiToken: "tok" } });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://notion.so/page", properties: { Title: { type: "title", title: [{ plain_text: "My Page" }] } } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new MCPClient(registry as never);
    const result = await client.fetchReference({ provider: "notion", type: "page", id: "abc123def456abc123def456abc12345", url: "" });

    expect(result?.title).toBe("My Page");
    vi.unstubAllGlobals();
  });
});
