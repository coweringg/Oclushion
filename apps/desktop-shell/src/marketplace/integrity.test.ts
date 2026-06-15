import { describe, expect, it } from "vitest";

import { assertSha256, sha256Hex } from "./integrity";

describe("sha256Hex", () => {
  it("computes correct SHA-256 for a string", async () => {
    const hash = await sha256Hex("hello");
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("computes correct SHA-256 for Uint8Array", async () => {
    const bytes = new TextEncoder().encode("hello");
    const hash = await sha256Hex(bytes);
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("returns 64-character hex string", async () => {
    const hash = await sha256Hex("test");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("assertSha256", () => {
  it("returns hash when match succeeds", async () => {
    const expected = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    const result = await assertSha256("hello", expected, "test-file");
    expect(result).toBe(expected);
  });

  it("is case-insensitive for comparison", async () => {
    const expected = "2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824";
    const result = await assertSha256("hello", expected, "test-file");
    expect(result).toBe(expected.toLowerCase());
  });

  it("throws when hash does not match", async () => {
    await expect(
      assertSha256("hello", "0000000000000000000000000000000000000000000000000000000000000000", "test-file"),
    ).rejects.toThrow("Integrity check failed for test-file");
  });

  it("throws when lengths differ", async () => {
    await expect(
      assertSha256("hello", "abc", "test-file"),
    ).rejects.toThrow("Integrity check failed");
  });
});
