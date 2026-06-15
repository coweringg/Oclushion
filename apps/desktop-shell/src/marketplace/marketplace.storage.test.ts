import { describe, expect, it } from "vitest";

import { MemoryMarketplaceFileSystem, joinMarketplacePath } from "./marketplace.storage";

describe("MemoryMarketplaceFileSystem", () => {
  it("reads null for non-existent file", async () => {
    const fs = new MemoryMarketplaceFileSystem();
    expect(await fs.readText("/missing")).toBeNull();
  });

  it("writes and reads text files", async () => {
    const fs = new MemoryMarketplaceFileSystem();
    await fs.writeText("/skills/s1/manifest.json", '{"id":"s1"}');
    expect(await fs.readText("/skills/s1/manifest.json")).toBe('{"id":"s1"}');
  });

  it("writes and reads binary files", async () => {
    const fs = new MemoryMarketplaceFileSystem();
    const data = new Uint8Array([1, 2, 3]);
    await fs.writeBinary("/tools/t1/binary", data);
    expect(fs.readBinary("/tools/t1/binary")).toEqual(data);
  });

  it("tracks write paths", async () => {
    const fs = new MemoryMarketplaceFileSystem();
    await fs.writeText("/a.txt", "content");
    await fs.writeBinary("/b.bin", new Uint8Array([1]));
    expect(fs.writes).toEqual(["/a.txt", "/b.bin"]);
    expect(fs.binaryWrites).toEqual(["/b.bin"]);
  });

  it("removes files", async () => {
    const fs = new MemoryMarketplaceFileSystem();
    await fs.writeText("/file.txt", "data");
    expect(await fs.exists("/file.txt")).toBe(true);
    await fs.remove("/file.txt");
    expect(await fs.exists("/file.txt")).toBe(false);
  });

  it("removes directories recursively", async () => {
    const fs = new MemoryMarketplaceFileSystem();
    await fs.writeText("/dir/a.txt", "a");
    await fs.writeText("/dir/b.txt", "b");
    await fs.remove("/dir");
    expect(await fs.exists("/dir/a.txt")).toBe(false);
    expect(await fs.exists("/dir/b.txt")).toBe(false);
  });

  it("exists returns true for directories", async () => {
    const fs = new MemoryMarketplaceFileSystem();
    await fs.ensureDir("/my-dir");
    expect(await fs.exists("/my-dir")).toBe(true);
  });

  it("normalizes backslash paths", async () => {
    const fs = new MemoryMarketplaceFileSystem();
    await fs.writeText("/skills\\manifest.json", "data");
    expect(await fs.readText("/skills/manifest.json")).toBe("data");
  });
});

describe("joinMarketplacePath", () => {
  it("joins path parts with slashes", () => {
    expect(joinMarketplacePath("/skills", "s1", "file.json")).toBe("/skills/s1/file.json");
  });

  it("normalizes duplicate slashes", () => {
    expect(joinMarketplacePath("//a//", "b")).toBe("/a/b");
  });

  it("filters empty parts", () => {
    expect(joinMarketplacePath("a", "", "b")).toBe("a/b");
  });

  it("removes trailing slash", () => {
    expect(joinMarketplacePath("/a/b/")).toBe("/a/b");
  });
});
