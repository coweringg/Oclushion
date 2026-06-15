import { describe, expect, it } from "vitest";

import {
  buildDependencyGraph,
  createMockSourceFiles,
  packRepositoryContext,
  parseImportsAndExports,
  type RepoSourceFile,
} from "./context.service";

describe("Context Engine", () => {
  it("parses TS/JS imports and export-from declarations", () => {
    const file: RepoSourceFile = {
      path: "src/index.ts",
      absolutePath: "mock://src/index.ts",
      type: "source",
      extension: "ts",
      relevanceScore: 90,
      tokenEstimate: 0,
      content: `
        import { createApp } from "./app";
        import type { Config } from "../config";
        export { createServer } from "./server";
      `,
    };

    expect(parseImportsAndExports(file)).toMatchObject({
      imports: ["./app", "../config"],
      exports: ["./server"],
      dependsOn: ["./app", "../config"],
    });
  });

  it("builds a lightweight dependency graph for source files", () => {
    const graph = buildDependencyGraph(createMockSourceFiles());

    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes[0]).toMatchObject({
      path: "src/api/controllers/user.controller.ts",
      dependsOn: ["../services/user.service", "../validators/user.validator"],
    });
  });

  it("packs relevant files without exceeding the token budget", () => {
    const files = createMockSourceFiles();
    const packed = packRepositoryContext(files, 80);

    expect(packed.usedTokens).toBeLessThanOrEqual(80);
    expect(packed.files.length).toBeGreaterThan(0);
    expect(packed.files[0]?.path).toBe("src/api/services/user.service.ts");
    expect(packed.droppedFiles).toBeGreaterThan(0);
  });
});
