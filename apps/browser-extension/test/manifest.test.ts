import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Browser extension manifest", () => {
  it("uses Manifest V3 with minimal supported host permissions", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../src/manifest.json", import.meta.url), "utf8"),
    ) as {
      manifest_version: number;
      permissions: string[];
      host_permissions: string[];
      content_scripts: Array<{ matches: string[] }>;
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["activeTab", "storage"]);
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining(["https://chatgpt.com"]),
    );
  });
});
