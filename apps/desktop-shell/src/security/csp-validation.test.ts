import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TAURI_CONF_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../src-tauri/tauri.conf.json");

const REQUIRED_CONNECT_SRCS = [
  "https://cdn.oclushion.com",
  "https://api.oclushion.com",
  "http://localhost:11434",
] as const;

function getCsp(config: { app?: { security?: { csp?: string } } }): string {
  const csp = config.app?.security?.csp;
  if (!csp) throw new Error("CSP not found in tauri.conf.json");
  return csp;
}

function parseCsp(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  const parts = csp.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [directive, ...values] = trimmed.split(" ");
    directives.set(directive ?? "", values.map((v) => v.trim()));
  }
  return directives;
}

describe("CSP Configuration", () => {
  it("tauri.conf.json exists and is valid JSON", () => {
    const content = readFileSync(TAURI_CONF_PATH, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("CSP is defined in tauri.conf.json", () => {
    const content = readFileSync(TAURI_CONF_PATH, "utf-8");
    const config = JSON.parse(content) as { app?: { security?: { csp?: string } } };
    expect(getCsp(config)).toBeDefined();
    expect(typeof getCsp(config)).toBe("string");
  });

  it("connect-src includes cdn.oclushion.com for marketplace catalog", () => {
    const content = readFileSync(TAURI_CONF_PATH, "utf-8");
    const config = JSON.parse(content) as { app?: { security?: { csp?: string } } };
    const directives = parseCsp(getCsp(config));
    const connectSrc = directives.get("connect-src") ?? [];
    expect(connectSrc).toContain("https://cdn.oclushion.com");
  });

  it("connect-src includes api.oclushion.com for control API", () => {
    const content = readFileSync(TAURI_CONF_PATH, "utf-8");
    const config = JSON.parse(content) as { app?: { security?: { csp?: string } } };
    const directives = parseCsp(getCsp(config));
    const connectSrc = directives.get("connect-src") ?? [];
    expect(connectSrc).toContain("https://api.oclushion.com");
  });

  it("connect-src includes localhost:11434 for Ollama local development", () => {
    const content = readFileSync(TAURI_CONF_PATH, "utf-8");
    const config = JSON.parse(content) as { app?: { security?: { csp?: string } } };
    const directives = parseCsp(getCsp(config));
    const connectSrc = directives.get("connect-src") ?? [];
    expect(connectSrc).toContain("http://localhost:11434");
  });

  it("connect-src includes api.openai.com and api.anthropic.com for LLM providers", () => {
    const content = readFileSync(TAURI_CONF_PATH, "utf-8");
    const config = JSON.parse(content) as { app?: { security?: { csp?: string } } };
    const directives = parseCsp(getCsp(config));
    const connectSrc = directives.get("connect-src") ?? [];
    expect(connectSrc).toContain("https://api.openai.com");
    expect(connectSrc).toContain("https://api.anthropic.com");
  });

  it("default-src is set to 'self' as restrictive baseline", () => {
    const content = readFileSync(TAURI_CONF_PATH, "utf-8");
    const config = JSON.parse(content) as { app?: { security?: { csp?: string } } };
    const directives = parseCsp(getCsp(config));
    const defaultSrc = directives.get("default-src") ?? [];
    expect(defaultSrc).toContain("'self'");
  });

  it("script-src is set to 'self' (no unsafe-inline for XSS protection)", () => {
    const content = readFileSync(TAURI_CONF_PATH, "utf-8");
    const config = JSON.parse(content) as { app?: { security?: { csp?: string } } };
    const directives = parseCsp(getCsp(config));
    const scriptSrc = directives.get("script-src") ?? [];
    expect(scriptSrc).toContain("'self'");
  });

  it("all required domains are covered by connect-src", () => {
    const content = readFileSync(TAURI_CONF_PATH, "utf-8");
    const config = JSON.parse(content) as { app?: { security?: { csp?: string } } };
    const directives = parseCsp(getCsp(config));
    const connectSrc = directives.get("connect-src") ?? [];
    for (const required of REQUIRED_CONNECT_SRCS) {
      expect(connectSrc, `connect-src must include ${required}`).toContain(required);
    }
  });
});