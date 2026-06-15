#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const CLONE_DIR = join(process.env.TEMP || "/tmp", "opencode", "claude-code-templates", "cli-tool", "components");
const OC_SKILLS_DIR = join(ROOT, "docker/data/marketplace/v1/skills");
const OC_CATALOG = join(ROOT, "docker/data/marketplace/v1/catalog.json");
const OC_FALLBACK = join(ROOT, "apps/desktop-shell/src/marketplace/fallback-catalog.ts");
const CDN_BASE = "https://cdn.oclushion.com/marketplace/v1/skills";

const CATEGORY_MAP = {
  analysis: "data",
  automation: "devops",
  azure: "devops",
  database: "backend",
  deployment: "devops",
  design: "design",
  documentation: "documentation",
  "game-development": "game-development",
  "git-workflow": "code-review",
  git: "code-review",
  "google-workspace": "productivity",
  marketing: "productivity",
  "nextjs-vercel": "frontend",
  orchestration: "devops",
  performance: "devops",
  "project-management": "productivity",
  security: "security",
  setup: "devops",
  simulation: "ai",
  svelte: "frontend",
  sync: "devops",
  team: "productivity",
  testing: "testing",
  utilities: "productivity",
  notification: "devops",
  development: "fullstack",
  project: "productivity",
  audio: "media",
  browser_automation: "testing",
  deepgraph: "ai",
  deepresearch: "research",
  devtools: "devops",
  filesystem: "devops",
  integration: "backend",
  "web-data": "data",
  web: "frontend",
  productivity: "productivity",
  research: "research",
};

const TIER_OVERRIDES = {
  security: "enterprise",
  "web-data": "pro",
  database: "pro",
  azure: "pro",
  deepresearch: "enterprise",
  deepgraph: "pro",
  browser_automation: "pro",
};

function slugToName(slug) {
  return slug
    .split(/[-_]/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function extractPreviewLines(content) {
  return content
    .split("\n")
    .slice(0, 5)
    .filter((l) => l.trim() && !l.startsWith("---"));
}

function buildSkillMd(name, description, body, category, sourceId, toolsField) {
  const tools = toolsField || "Read, Write, Edit, Bash, Glob, Grep";
  return `---
name: ${name}
description: "${(description || `${slugToName(name)} from aitmpl.com`).replace(/"/g, "'")}"
risk: safe
source: aitmpl
source_id: "${sourceId}"
category: "${category}"
tools: ${tools}
date_added: "2026-06-11"
---

# ${slugToName(name)}

${body.trim()}
`;
}

function processCommands() {
  console.log("\n=== Commands ===\n");
  const entries = [];
  const base = join(CLONE_DIR, "commands");
  if (!existsSync(base)) return entries;

  const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of dirs) {
    const cmdDir = join(base, dir.name);
    const files = readdirSync(cmdDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = readFileSync(join(cmdDir, file), "utf-8");
      const name = file.replace(/\.md$/, "");
      const category = CATEGORY_MAP[dir.name] || "productivity";
      const id = `aitmpl-cmd-${dir.name}-${name}`;

      const titleMatch = content.match(/^#\s+(.+)/m);
      const description = titleMatch ? titleMatch[1].trim() : `${slugToName(name)} command`;

      const md = buildSkillMd(`cmd-${name}`, description, content, category, `commands/${dir.name}/${file}`);
      const hash = sha256(md);
      const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));

      entries.push({
        id,
        name: `Cmd: ${slugToName(name)}`,
        description: description.slice(0, 300),
        category,
        tier: "free",
        version: "1.0.0",
        downloadUrl: `${CDN_BASE}/${id}.md`,
        sha256: hash,
        sizeKb,
        keywords: [category, dir.name, "command", "aitmpl", ...name.split(/[-_]/)],
        previewLines: extractPreviewLines(md),
      });

      writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
      console.log(`  cmd: ${id}`);
    }
  }
  return entries;
}

function processHooks() {
  console.log("\n=== Hooks ===\n");
  const entries = [];
  const base = join(CLONE_DIR, "hooks");
  if (!existsSync(base)) return entries;

  const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of dirs) {
    const hookDir = join(base, dir.name);
    const files = readdirSync(hookDir).filter((f) => !f.startsWith("."));
    for (const file of files) {
      const content = readFileSync(join(hookDir, file), "utf-8");
      const name = file.replace(/\.(py|sh|js|ts|ps1|json|yaml|yml|md)$/, "");
      const category = CATEGORY_MAP[dir.name] || "devops";
      const id = `aitmpl-hook-${dir.name}-${name}`;

      const md = buildSkillMd(`hook-${name}`, `Automation hook/script from aitmpl.com: ${dir.name}/${file}`,
        "## Description\n\nAutomation hook from aitmpl.com for " + dir.name + ".\n\n## Script Content\n\n```\n" + content + "\n```",
        category, `hooks/${dir.name}/${file}`);
      const hash = sha256(md);
      const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));

      entries.push({
        id,
        name: `Hook: ${slugToName(name)}`,
        description: `Automation hook from aitmpl.com: ${dir.name}/${file}`,
        category,
        tier: "free",
        version: "1.0.0",
        downloadUrl: `${CDN_BASE}/${id}.md`,
        sha256: hash,
        sizeKb,
        keywords: [category, dir.name, "hook", "automation", "aitmpl", ...name.split(/[-_]/)],
        previewLines: extractPreviewLines(md),
      });

      writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
      console.log(`  hook: ${id}`);
    }
  }
  return entries;
}

function processSettings() {
  console.log("\n=== Settings ===\n");
  const entries = [];
  const base = join(CLONE_DIR, "settings");
  if (!existsSync(base)) return entries;

  const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of dirs) {
    const settingDir = join(base, dir.name);
    const files = readdirSync(settingDir).filter((f) => !f.startsWith("."));
    for (const file of files) {
      const content = readFileSync(join(settingDir, file), "utf-8");
      const name = file.replace(/\.(json|md|yaml|yml)$/, "");
      const category = CATEGORY_MAP[dir.name] || "productivity";
      const id = `aitmpl-setting-${dir.name}-${name}`;

      const md = buildSkillMd(`setting-${name}`, `Configuration from aitmpl.com: ${dir.name}/${file}`,
        "## Description\n\nConfiguration template from aitmpl.com for " + dir.name + ".\n\n## Content\n\n```\n" + content + "\n```",
        category, `settings/${dir.name}/${file}`);
      const hash = sha256(md);
      const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));

      entries.push({
        id,
        name: `Setting: ${slugToName(name)}`,
        description: `Configuration from aitmpl.com: ${dir.name}/${file}`,
        category,
        tier: "free",
        version: "1.0.0",
        downloadUrl: `${CDN_BASE}/${id}.md`,
        sha256: hash,
        sizeKb,
        keywords: [category, dir.name, "setting", "configuration", "aitmpl", ...name.split(/[-_]/)],
        previewLines: extractPreviewLines(md),
      });

      writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
      console.log(`  setting: ${id}`);
    }
  }
  return entries;
}

function processMCPs() {
  console.log("\n=== MCPs ===\n");
  const entries = [];
  const base = join(CLONE_DIR, "mcps");
  if (!existsSync(base)) return entries;

  const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of dirs) {
    const mcpDir = join(base, dir.name);
    const files = readdirSync(mcpDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const content = readFileSync(join(mcpDir, file), "utf-8");
      const name = file.replace(/\.json$/, "");
      const id = `aitmpl-mcp-${dir.name}-${name}`;

      let parsed;
      try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

      const serverDesc = parsed?.mcpServers
        ? Object.entries(parsed.mcpServers).map(([k, v]) => `- **${k}**: ${v.description || ""}`).join("\n")
        : "";

      const desc = parsed?.mcpServers
        ? Object.values(parsed.mcpServers).map(s => s.description).filter(Boolean).join(". ")
        : `${slugToName(name)} MCP server`;

      const category = CATEGORY_MAP[dir.name] || "integration";
      const tier = TIER_OVERRIDES[dir.name] || "pro";

      const md = `---
name: mcp-${name}
description: "${desc.replace(/"/g, "'").slice(0, 300)}"
risk: safe
source: aitmpl
source_id: "mcps/${dir.name}/${file}"
category: "${category}"
tools: Read, Write, Edit
date_added: "2026-06-11"
---

# MCP: ${slugToName(name)}

## Description

${desc}

## Server Configuration

${serverDesc}

## Installation

Add this configuration to your project's \`.mcp.json\` file:

\`\`\`json
${JSON.stringify(parsed, null, 2)}
\`\`\`
`;

      const hash = sha256(md);
      const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));

      entries.push({
        id,
        name: `MCP: ${slugToName(name)}`,
        description: desc.slice(0, 300),
        category,
        tier,
        version: "1.0.0",
        downloadUrl: `${CDN_BASE}/${id}.md`,
        sha256: hash,
        sizeKb,
        keywords: [category, dir.name, "mcp", "aitmpl", ...name.split(/[-_]/)],
        previewLines: extractPreviewLines(md),
      });

      writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
      console.log(`  mcp: ${id}`);
    }
  }
  return entries;
}

function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Oclushion aitmpl Local Import (Remaining)  ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  if (!existsSync(CLONE_DIR)) {
    console.error(`✗ Clone not found at ${CLONE_DIR}`);
    process.exit(1);
  }

  mkdirSync(OC_SKILLS_DIR, { recursive: true });

  let catalog = { skills: [], tools: [] };
  if (existsSync(OC_CATALOG)) {
    try {
      catalog = JSON.parse(readFileSync(OC_CATALOG, "utf-8"));
    } catch (e) {
      console.warn("⚠ Could not read existing catalog");
    }
  }

  const existingIds = new Set(catalog.skills.map((s) => s.id));
  console.log(`Existing catalog: ${catalog.skills.length} skills`);

  const cmdEntries = processCommands();
  const hookEntries = processHooks();
  const settingEntries = processSettings();
  const mcpEntries = processMCPs();

  const allEntries = [...cmdEntries, ...hookEntries, ...settingEntries, ...mcpEntries];
  const newEntries = allEntries.filter((e) => !existingIds.has(e.id));
  const duplicates = allEntries.filter((e) => existingIds.has(e.id)).length;

  console.log(`\n=== Results ===`);
  console.log(`  Commands: ${cmdEntries.length}`);
  console.log(`  Hooks: ${hookEntries.length}`);
  console.log(`  Settings: ${settingEntries.length}`);
  console.log(`  MCPs: ${mcpEntries.length}`);
  console.log(`  ---`);
  console.log(`  Duplicates skipped: ${duplicates}`);
  console.log(`  New to add: ${newEntries.length}`);

  catalog.skills = [...catalog.skills, ...newEntries];
  writeFileSync(OC_CATALOG, JSON.stringify(catalog, null, 2));
  console.log(`\n✓ Catalog: ${catalog.skills.length} skills (+${newEntries.length})`);

  const fallback = `// ⚡ Auto-generated — DO NOT EDIT
import type { Skill, AiTool, MarketplaceCatalog } from "./marketplace.types";

const skills: Skill[] = ${JSON.stringify(catalog.skills, null, 2)};

const tools: AiTool[] = ${JSON.stringify(catalog.tools, null, 2)};

function validateFallbackCatalog(): MarketplaceCatalog {
  return { skills, tools };
}

export const FALLBACK_CATALOG = validateFallbackCatalog();
`;
  writeFileSync(OC_FALLBACK, fallback, "utf-8");
  console.log(`✓ Fallback: ${catalog.skills.length} skills`);

  console.log(`\n✓ Done!`);
}

main();
