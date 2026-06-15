import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const localesDir = join(repoRoot, "apps/desktop-shell/src/i18n/locales");

const REQUIRED_LOCALES = ["en", "es", "fr", "de", "ja", "ko", "pt", "zh"];
const HARDCODED_PATTERNS = [
  /\.innerHTML\s*=\s*`[^`]*[a-z]{2,}[^`]*`/gi,
  /\.textContent\s*=\s*`[^`]*[a-z]{2,}[^`]*`/gi,
  /placeholder\s*=\s*["'][^"']*[a-z]{2,}[^"']*["']/gi,
  /title\s*=\s*["'][^"']*[a-z]{2,}[^"']*["']/gi,
  />\s*[A-Z][a-z]+(?:\s+[a-z]+)*\s*</g,
];

const SCAN_DIRS = [
  "apps/desktop-shell/src/app",
  "apps/desktop-shell/src/ui",
];

let exitCode = 0;

function checkLocaleFiles() {
  console.log("\n--- Checking locale files ---");
  let ok = true;

  if (!existsSync(localesDir)) {
    console.error(`ERROR: locales directory not found at ${localesDir}`);
    process.exit(1);
  }

  const enPath = join(localesDir, "en.json");
  if (!existsSync(enPath)) {
    console.error("ERROR: en.json not found");
    process.exit(1);
  }

  const enKeys = collectKeys(JSON.parse(readFileSync(enPath, "utf-8")));

  for (const locale of REQUIRED_LOCALES) {
    const localePath = join(localesDir, `${locale}.json`);
    if (!existsSync(localePath)) {
      console.error(`ERROR: ${locale}.json is missing`);
      ok = false;
      exitCode = 1;
      continue;
    }

    const localeKeys = collectKeys(JSON.parse(readFileSync(localePath, "utf-8")));
    const missing = enKeys.filter((k) => !localeKeys.includes(k));

    if (missing.length > 0) {
      console.warn(`WARN: ${locale}.json missing ${missing.length} keys (compared to en.json)`);
      ok = false;
    }

    const extra = localeKeys.filter((k) => !enKeys.includes(k));
    if (extra.length > 0) {
      console.warn(`WARN: ${locale}.json has ${extra.length} extra keys not in en.json`);
    }
  }

  console.log(`Locale files: ${ok ? "PASS" : "ISSUES FOUND"}`);
  return ok;
}

function checkHardcodedStrings() {
  console.log("\n--- Scanning for hardcoded UI strings ---");
  let issues = 0;

  for (const dir of SCAN_DIRS) {
    const fullDir = join(repoRoot, dir);
    if (!existsSync(fullDir)) {
      console.warn(`WARN: ${dir} not found, skipping`);
      continue;
    }

    const files = readdirSync(fullDir, { recursive: true })
      .filter((f) => typeof f === "string" && f.endsWith(".ts"))
      .map((f) => join(fullDir, f));

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("t(") || line.includes("i18n") || line.includes("// i18n")) continue;

        for (const pattern of HARDCODED_PATTERNS) {
          if (pattern.test(line)) {
            console.warn(`  HARDCODED: ${file.replace(repoRoot, "")}:${i + 1}  ${line.trim().slice(0, 80)}`);
            issues++;
            break;
          }
        }
      }
    }
  }

  console.log(`Hardcoded strings: ${issues} potential issues`);
  return issues === 0;
}

function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...collectKeys(value, fullKey));
    }
    keys.push(fullKey);
  }
  return keys;
}

const localesOk = checkLocaleFiles();
const hardcodedOk = checkHardcodedStrings();

console.log(`\n--- Summary ---`);
console.log(`Locale files: ${localesOk ? "PASS" : "ISSUES"}`);
console.log(`Hardcoded strings: ${hardcodedOk ? "PASS" : `${exitCode} ISSUES`}`);

if (!localesOk || !hardcodedOk) exitCode = 1;
process.exit(exitCode);
