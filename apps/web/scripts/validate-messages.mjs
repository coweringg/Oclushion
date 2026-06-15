import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const locales = ["en", "es", "fr", "zh", "pt", "de", "ja", "ko"];

function flatten(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flatten(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

const keysets = new Map();
for (const locale of locales) {
  const file = join(root, "messages", `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  keysets.set(locale, new Set(flatten(json).filter(Boolean)));
}

const reference = keysets.get("en");
let failed = false;
for (const locale of locales.slice(1)) {
  const keys = keysets.get(locale);
  const missing = [...reference].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !reference.has(key));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`[i18n] ${locale}.json does not match en.json`);
    if (missing.length) console.error(`Missing: ${missing.join(", ")}`);
    if (extra.length) console.error(`Extra: ${extra.join(", ")}`);
  }
}

if (failed) {
  process.exit(1);
}
