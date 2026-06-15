import { describe, expect, it, vi, beforeEach } from "vitest";
import { EditorStateService } from "./editor-state.service";
import { LanguageDetectorService } from "./language-detector.service";
import type { EditorFile } from "./editor.types";

function createMockFile(overrides: Partial<EditorFile> = {}): EditorFile {
  return {
    path: "src/app.ts",
    absolutePath: "/workspace/src/app.ts",
    content: "const x = 1;",
    language: "typescript",
    size: 100,
    modified: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("EditorStateService", () => {
  let service: EditorStateService;

  beforeEach(() => {
    service = new EditorStateService();
  });

  it("opens a file and sets it as active", () => {
    const file = createMockFile();
    service.openFile(file);

    expect(service.getActiveFile()?.path).toBe("src/app.ts");
    expect(service.getOpenFiles()).toHaveLength(1);
  });

  it("does not duplicate files when opening the same path", () => {
    const file = createMockFile();
    service.openFile(file);
    service.openFile(file);

    expect(service.getOpenFiles()).toHaveLength(1);
  });

  it("switches active file when opening a different file", () => {
    service.openFile(createMockFile({ path: "src/a.ts" }));
    service.openFile(createMockFile({ path: "src/b.ts" }));

    expect(service.getActiveFile()?.path).toBe("src/b.ts");
  });

  it("closes a file and switches to adjacent tab", () => {
    service.openFile(createMockFile({ path: "src/a.ts" }));
    service.openFile(createMockFile({ path: "src/b.ts" }));
    service.openFile(createMockFile({ path: "src/c.ts" }));

    service.closeFile("src/b.ts");

    expect(service.getOpenFiles()).toHaveLength(2);
    expect(service.getActiveFile()?.path).toBe("src/c.ts");
  });

  it("sets active to null when closing the last file", () => {
    service.openFile(createMockFile());
    service.closeFile("src/app.ts");

    expect(service.getActiveFile()).toBeNull();
  });

  it("marks file as modified", () => {
    service.openFile(createMockFile());
    service.markModified("src/app.ts", "const x = 2;");

    expect(service.getActiveFile()?.modified).toBe(true);
    expect(service.getActiveFile()?.content).toBe("const x = 2;");
  });

  it("marks file as saved", () => {
    service.openFile(createMockFile());
    service.markModified("src/app.ts", "const x = 2;");
    service.markSaved("src/app.ts", "const x = 2;");

    expect(service.getActiveFile()?.modified).toBe(false);
  });

  it("reverts file to original content", () => {
    service.openFile(createMockFile({ content: "original" }));
    service.markModified("src/app.ts", "modified");
    service.revertFile("src/app.ts", "original");

    expect(service.getActiveFile()?.content).toBe("original");
    expect(service.getActiveFile()?.modified).toBe(false);
  });

  it("tracks MRU list", () => {
    service.openFile(createMockFile({ path: "src/a.ts" }));
    service.openFile(createMockFile({ path: "src/b.ts" }));
    service.openFile(createMockFile({ path: "src/c.ts" }));
    service.setActiveFile("src/a.ts");

    expect(service.getRecentFiles()).toEqual(["src/a.ts", "src/c.ts", "src/b.ts"]);
  });

  it("reports unsaved changes correctly", () => {
    service.openFile(createMockFile({ path: "src/a.ts" }));
    service.openFile(createMockFile({ path: "src/b.ts" }));
    service.markModified("src/a.ts", "changed");

    expect(service.hasUnsavedChanges()).toBe(true);
    expect(service.getUnsavedFiles()).toHaveLength(1);
    expect(service.getUnsavedFiles()[0]?.path).toBe("src/a.ts");
  });

  it("emits events on file operations", () => {
    const events: string[] = [];
    service.subscribe((event) => events.push(event.type));

    service.openFile(createMockFile());
    service.markModified("src/app.ts", "new content");
    service.closeFile("src/app.ts");

    expect(events).toContain("file:opened");
    expect(events).toContain("file:modified");
    expect(events).toContain("file:closed");
  });
});

describe("LanguageDetectorService", () => {
  let service: LanguageDetectorService;

  beforeEach(() => {
    service = new LanguageDetectorService();
  });

  it("detects TypeScript from .ts extension", () => {
    expect(service.detect("ts")).toBe("typescript");
  });

  it("detects JavaScript from .js extension", () => {
    expect(service.detect("js")).toBe("javascript");
  });

  it("detects JSON from .json extension", () => {
    expect(service.detect("json")).toBe("json");
  });

  it("detects HTML from .html extension", () => {
    expect(service.detect("html")).toBe("html");
  });

  it("detects CSS from .css extension", () => {
    expect(service.detect("css")).toBe("css");
  });

  it("detects Python from .py extension", () => {
    expect(service.detect("py")).toBe("python");
  });

  it("detects Rust from .rs extension", () => {
    expect(service.detect("rs")).toBe("rust");
  });

  it("detects Markdown from .md extension", () => {
    expect(service.detect("md")).toBe("markdown");
  });

  it("returns plaintext for unknown extensions", () => {
    expect(service.detect("xyz")).toBe("plaintext");
  });

  it("returns correct labels", () => {
    expect(service.getLabel("typescript")).toBe("TypeScript");
    expect(service.getLabel("python")).toBe("Python");
    expect(service.getLabel("plaintext")).toBe("Plain Text");
  });
});
