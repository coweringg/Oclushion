#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SKILLS_DIR = join(ROOT, "docker/data/marketplace/v1/skills");
const TOOLS_DIR = join(ROOT, "docker/data/marketplace/v1/tools");
const CATALOG_SRC = join(ROOT, "docker/data/marketplace/v1/catalog.json");
const OUT_DIR = join(ROOT, "dist/marketplace");

function sha256(filePath) {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function build() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(join(OUT_DIR, "skills"), { recursive: true });
  mkdirSync(join(OUT_DIR, "tools"), { recursive: true });

  const catalog = existsSync(CATALOG_SRC)
    ? JSON.parse(readFileSync(CATALOG_SRC, "utf-8"))
    : { skills: [], tools: [] };

  const skillFiles = existsSync(SKILLS_DIR)
    ? readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".md"))
    : [];

  const seenIds = new Set();

  for (const file of skillFiles) {
    const srcPath = join(SKILLS_DIR, file);
    const skillId = file.replace(/\.md$/, "");
    const hash = sha256(srcPath);
    const sizeKb = Math.round(statSync(srcPath).size / 1024);

    const existing = catalog.skills.find((s) => s.id === skillId);
    const previewLines = readFileSync(srcPath, "utf-8")
      .split("\n")
      .slice(0, 5)
      .filter((l) => l.trim());

    if (existing) {
      existing.sha256 = hash;
      existing.sizeKb = sizeKb;
      existing.previewLines = previewLines;
    } else {
      catalog.skills.push({
        id: skillId,
        name: skillId.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: `${skillId} skill`,
        category: "productivity",
        tier: "free",
        version: "1.0.0",
        downloadUrl: `/v1/marketplace/skills/${skillId}/download`,
        sha256: hash,
        sizeKb,
        keywords: [],
        previewLines,
      });
    }
    seenIds.add(skillId);

    const outPath = join(OUT_DIR, "skills", file);
    writeFileSync(outPath, readFileSync(srcPath));
    console.log(`  skill: ${file} (${hash.slice(0, 16)}... ${sizeKb}KB)`);
  }

  catalog.skills = catalog.skills.filter((s) => seenIds.has(s.id));

  const toolFiles = existsSync(TOOLS_DIR)
    ? readdirSync(TOOLS_DIR).filter((f) => f.endsWith(".md"))
    : [];

  for (const file of toolFiles) {
    const srcPath = join(TOOLS_DIR, file);
    const toolId = file.replace(/\.md$/, "");
    const hash = sha256(srcPath);

    const existing = catalog.tools.find((t) => t.id === toolId);
    if (existing) {
      existing.sha256 = hash;
    }
    console.log(`  tool: ${file} (${hash.slice(0, 16)}...)`);

    const outPath = join(OUT_DIR, "tools", file);
    writeFileSync(outPath, readFileSync(srcPath));
  }

  const catalogPath = join(OUT_DIR, "catalog.json");
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log(`\n✓ Wrote catalog.json (${catalog.skills.length} skills, ${catalog.tools.length} tools)`);
  console.log(`  SHA-256: ${sha256(catalogPath)}`);
  console.log(`  Output: ${OUT_DIR}`);
}

build();
