import { describe, expect, it } from "vitest";

import { escapeXml } from "./escape-xml.js";

describe("escapeXml", () => {
  it("escapes ampersands", () => {
    expect(escapeXml("a&b")).toBe("a&amp;b");
  });

  it("escapes less-than", () => {
    expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
  });

  it("escapes greater-than", () => {
    expect(escapeXml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeXml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeXml("it's")).toBe("it&apos;s");
  });

  it("escapes all special chars together", () => {
    expect(escapeXml("<a href=\"x&y\">it's</a>")).toBe("&lt;a href=&quot;x&amp;y&quot;&gt;it&apos;s&lt;/a&gt;");
  });

  it("returns empty string for empty input", () => {
    expect(escapeXml("")).toBe("");
  });

  it("returns same string for plain text", () => {
    expect(escapeXml("hello world 123")).toBe("hello world 123");
  });

  it("replaces all occurrences (not just first)", () => {
    expect(escapeXml("a&b&c")).toBe("a&amp;b&amp;c");
  });
});
