import { describe, it, expect, beforeEach, vi } from "vitest";
import { MarketplaceSearchService } from "./marketplace-search.service";

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

const mockItems = [
  { id: "1", name: "Full Stack Developer", description: "TypeScript, backend, frontend", type: "skill" as const, tier: "Free" },
  { id: "2", name: "Database Staff", description: "PostgreSQL, MongoDB, Redis", type: "skill" as const, tier: "Pro" },
  { id: "3", name: "Security OWASP", description: "OWASP Top 10, threat modeling", type: "skill" as const, tier: "Free" },
  { id: "4", name: "ESLint Config", description: "Linting rules for TypeScript", type: "tool" as const, tier: "Free" },
];

describe("MarketplaceSearchService", () => {
  let service: MarketplaceSearchService;

  beforeEach(() => {
    localStorageMock.clear();
    service = new MarketplaceSearchService();
  });

  it("returns all items for empty query", async () => {
    const results = await service.search(mockItems, "");
    expect(results.length).toBe(4);
  });

  it("finds items by name", async () => {
    const results = await service.search(mockItems, "database");
    expect(results.length).toBe(1);
    expect(results[0]?.name).toBe("Database Staff");
  });

  it("finds items by description", async () => {
    const results = await service.search(mockItems, "TypeScript");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.name === "Full Stack Developer")).toBe(true);
  });

  it("is case insensitive", async () => {
    const results = await service.search(mockItems, "DATABASE");
    expect(results.length).toBe(1);
    expect(results[0]?.name).toBe("Database Staff");
  });

  it("filters by type", async () => {
    service.setFilter({ type: "tool" });
    const results = await service.search(mockItems, "");
    expect(results.length).toBe(1);
    expect(results[0]?.type).toBe("tool");
  });

  it("filters by tier", async () => {
    service.setFilter({ tier: "Pro" });
    const results = await service.search(mockItems, "");
    expect(results.length).toBe(1);
    expect(results[0]?.tier).toBe("Pro");
  });

  it("sorts by name", async () => {
    service.setFilter({ sort: "name" });
    const results = await service.search(mockItems, "");
    expect(results[0]?.name).toBe("Database Staff");
    expect(results[results.length - 1]?.name).toBe("Security OWASP");
  });

  it("resets filter", () => {
    service.setFilter({ type: "tool", tier: "Pro" });
    service.resetFilter();
    const filter = service.getFilter();
    expect(filter.type).toBeUndefined();
    expect(filter.tier).toBeUndefined();
  });

  it("saves and loads filters", () => {
    service.setFilter({ type: "skill", tier: "Free" });
    service.saveCurrentFilter();
    const saved = service.getSavedFilters();
    expect(saved.length).toBe(1);
    expect(saved[0]?.type).toBe("skill");
  });

  it("removes saved filter", () => {
    service.setFilter({ type: "skill" });
    service.saveCurrentFilter();
    service.removeSavedFilter(0);
    expect(service.getSavedFilters().length).toBe(0);
  });

  it("highlights matches in name", async () => {
    const results = await service.search(mockItems, "stack");
    expect(results.length).toBe(1);
    expect(results[0]?.matches.length).toBeGreaterThan(0);
  });
});
