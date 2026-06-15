import { describe, it, expect, beforeEach } from "vitest";
import { FileSearchService } from "./file-search.service";

describe("FileSearchService", () => {
  let service: FileSearchService;

  beforeEach(() => {
    service = new FileSearchService();
    service.setFiles([
      { path: "src/app/event-handlers.ts" },
      { path: "src/editor/editor.controller.ts" },
      { path: "src/editor/editor-state.service.ts" },
      { path: "src/styles/base.css" },
      { path: "src/i18n/locales/en.json" },
    ]);
  });

  it("returns empty for empty query", () => {
    expect(service.search("")).toEqual([]);
    expect(service.search("   ")).toEqual([]);
  });

  it("finds exact file name match", () => {
    const results = service.search("base.css");
    expect(results.length).toBe(1);
    expect(results[0]?.path).toBe("src/styles/base.css");
  });

  it("finds partial matches", () => {
    const results = service.search("editor");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some((r) => r.path.includes("editor.controller"))).toBe(true);
    expect(results.some((r) => r.path.includes("editor-state"))).toBe(true);
  });

  it("ranks exact matches higher than partial", () => {
    const results = service.search("en.json");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.path).toBe("src/i18n/locales/en.json");
  });

  it("limits results to 15", () => {
    service.setFiles(Array.from({ length: 20 }, (_, i) => ({ path: `file${i}.ts` })));
    const results = service.search("file");
    expect(results.length).toBeLessThanOrEqual(15);
  });

  it("is case insensitive", () => {
    const results = service.search("BASE.CSS");
    expect(results.length).toBe(1);
    expect(results[0]?.path).toBe("src/styles/base.css");
  });

  it("matches against full path", () => {
    const results = service.search("i18n");
    expect(results.length).toBe(1);
    expect(results[0]?.path).toBe("src/i18n/locales/en.json");
  });

  it("finds matches with typo tolerance", () => {
    const results = service.search("evnt");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
