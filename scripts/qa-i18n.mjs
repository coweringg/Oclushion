#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "..", "apps", "desktop-shell", "src", "i18n", "locales");

if (!existsSync(localesDir)) {
  console.error("Locales directory not found:", localesDir);
  process.exit(1);
}

const files = readdirSync(localesDir).filter((f) => f.endsWith(".json"));
const enRaw = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf-8"));

function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      keys.push(...flattenKeys(v, key));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

const enKeys = flattenKeys(enRaw);
const errors = [];

for (const file of files) {
  if (file === "en.json") continue;
  const content = readFileSync(join(localesDir, file), "utf-8");
  try { JSON.parse(content); } catch {
    errors.push(`[FAIL] ${file}: Invalid JSON`);
    continue;
  }
  const locale = JSON.parse(content);
  const localeKeys = flattenKeys(locale);
  const missing = enKeys.filter((k) => !localeKeys.includes(k));
  for (const k of missing) errors.push(`[FAIL] ${file}: Missing key "${k}"`);
  const extra = localeKeys.filter((k) => !enKeys.includes(k));
  for (const k of extra) errors.push(`[WARN] ${file}: Extra key "${k}" (not in en.json)`);
}

if (errors.length > 0) {
  console.error(`i18n QA: ${errors.length} issues found`);
  for (const e of errors) console.error(e);
  process.exit(1);
} else {
  console.log(`i18n QA: ${files.length} locale files, all keys present.`);
}
