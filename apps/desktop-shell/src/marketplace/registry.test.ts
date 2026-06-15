import { describe, expect, it, vi } from "vitest";

import { MarketplaceRegistry } from "./registry";

function mockFetch(response: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), { status, statusText: ok ? "OK" : "Error" }),
  );
}

const validSkill = {
  id: "skill-1",
  name: "Test Skill",
  description: "A test skill",
  category: "testing",
  tier: "community",
  version: "1.0.0",
  downloadUrl: "https://cdn.example.com/skill.zip",
  sha256: "a".repeat(64),
  sizeKb: 100,
};

const validTool = {
  id: "tool-1",
  name: "Test Tool",
  description: "A test tool",
  version: "1.0.0",
  downloadUrl: "https://cdn.example.com/tool.zip",
  platform: "linux",
  requiredBin: "test-tool",
  sha256: "b".repeat(64),
};

describe("MarketplaceRegistry", () => {
  it("fetches and validates a valid catalog", async () => {
    const fetcher = mockFetch({ skills: [validSkill], tools: [validTool] });
    const registry = new MarketplaceRegistry("https://example.com/catalog.json", fetcher as never);
    const catalog = await registry.fetchCatalog();
    expect(catalog.skills).toHaveLength(1);
    expect(catalog.tools).toHaveLength(1);
    expect(catalog.skills[0]?.id).toBe("skill-1");
  });

  it("falls back to fallback catalog on non-ok response", async () => {
    const fetcher = mockFetch(null, false, 404);
    const registry = new MarketplaceRegistry("https://example.com/catalog.json", fetcher as never);
    const catalog = await registry.fetchCatalog();
    expect(catalog.skills.length).toBeGreaterThan(0);
  });

  it("falls back to fallback catalog on invalid payload", async () => {
    const fetcher = mockFetch("not-an-object");
    const registry = new MarketplaceRegistry("https://example.com/catalog.json", fetcher as never);
    const catalog = await registry.fetchCatalog();
    expect(catalog.skills.length).toBeGreaterThan(0);
  });

  it("falls back to fallback catalog when skills is not an array", async () => {
    const fetcher = mockFetch({ skills: "not-array", tools: [] });
    const registry = new MarketplaceRegistry("https://example.com/catalog.json", fetcher as never);
    const catalog = await registry.fetchCatalog();
    expect(catalog.skills.length).toBeGreaterThan(0);
  });

  it("falls back to fallback catalog on missing skill fields", async () => {
    const fetcher = mockFetch({ skills: [{ id: "s1" }], tools: [] });
    const registry = new MarketplaceRegistry("https://example.com/catalog.json", fetcher as never);
    const catalog = await registry.fetchCatalog();
    expect(catalog.skills.length).toBeGreaterThan(0);
  });

  it("accepts HTTP download URLs (regex allows both http and https)", async () => {
    const skill = { ...validSkill, downloadUrl: "http://cdn.example.com/skill.zip" };
    const fetcher = mockFetch({ skills: [skill], tools: [] });
    const registry = new MarketplaceRegistry("https://example.com/catalog.json", fetcher as never);
    const catalog = await registry.fetchCatalog();
    expect(catalog.skills[0]?.downloadUrl).toBe("http://cdn.example.com/skill.zip");
  });

  it("falls back to fallback catalog on invalid SHA-256 format", async () => {
    const badSkill = { ...validSkill, sha256: "not-a-hash" };
    const fetcher = mockFetch({ skills: [badSkill], tools: [] });
    const registry = new MarketplaceRegistry("https://example.com/catalog.json", fetcher as never);
    const catalog = await registry.fetchCatalog();
    expect(catalog.skills.length).toBeGreaterThan(0);
  });

  it("normalizes skill sizeKb to number and defaults keywords", async () => {
    const skill = { ...validSkill, sizeKb: "200", keywords: undefined, previewLines: undefined };
    const fetcher = mockFetch({ skills: [skill], tools: [] });
    const registry = new MarketplaceRegistry("https://example.com/catalog.json", fetcher as never);
    const catalog = await registry.fetchCatalog();
    expect(catalog.skills[0]?.sizeKb).toBe(200);
    expect(catalog.skills[0]?.keywords).toEqual([]);
    expect(catalog.skills[0]?.previewLines).toEqual([]);
  });
});
