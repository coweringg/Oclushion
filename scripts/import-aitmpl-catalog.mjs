#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const GITHUB_RAW = "https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components";
const GITHUB_API = "https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components";

const OC_SKILLS_DIR = join(ROOT, "docker/data/marketplace/v1/skills");
const OC_TOOLS_DIR = join(ROOT, "docker/data/marketplace/v1/tools");
const OC_CATALOG = join(ROOT, "docker/data/marketplace/v1/catalog.json");
const OC_FALLBACK = join(ROOT, "apps/desktop-shell/src/marketplace/fallback-catalog.ts");

const CDN_BASE = "https://cdn.oclushion.com/marketplace/v1/skills";

const CATEGORY_MAP = {
  development: "fullstack",
  "web-development": "frontend",
  "design-to-code": "frontend",
  database: "backend",
  analytics: "data",
  "web-data": "data",
  "document-processing": "productivity",
  media: "design",
  video: "design",
  "creative-design": "design",
  "business-marketing": "productivity",
  marketing: "productivity",
  security: "security",
  "ai-maestro": "ai",
  "ai-research": "research",
  git: "code-review",
  "enterprise-communication": "productivity",
  "workflow-automation": "productivity",
  productivity: "productivity",
  utilities: "productivity",
  career: "productivity",
  scientific: "research",
  sports: "productivity",
  pocketbase: "backend",
  railway: "devops",
  sentry: "devops",
  "gmod-addon-maker": "game-development",
};

const TIER_MAP = {
  security: "enterprise",
  "ai-research": "enterprise",
  "devops-infrastructure": "pro",
  database: "pro",
  "web-data": "pro",
  analytics: "pro",
  "deep-research-team": "enterprise",
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

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Oclushion/1.0", Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Oclushion/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

function buildSkillMd(name, description, toolsField, body, category, sourceId) {
  const tools = toolsField || "Read, Write, Edit, Bash, Glob, Grep";
  const cleanBody = body
    .replace(/^---[\s\S]*?---\n*/m, "")
    .trim();

  const md = `---
name: ${name}
description: "${description.replace(/"/g, "'")}"
risk: safe
source: aitmpl
source_id: "${sourceId}"
category: "${category}"
tools: ${tools}
date_added: "2026-06-11"
---

# ${slugToName(name)}

${cleanBody}
`;
  return md;
}

function buildMCPTool(name, description, jsonContent) {
  const content = typeof jsonContent === "string" ? jsonContent : JSON.stringify(jsonContent, null, 2);
  return {
    id: name,
    name: slugToName(name),
    description: description || `${slugToName(name)} MCP server configuration`,
    type: "mcp",
    version: "1.0.0",
    content: `# ${slugToName(name)} MCP\n\n${description || ""}\n\n## Configuration\n\n\`\`\`json\n${content}\n\`\`\`\n`,
  };
}

async function importSkills() {
  console.log("\n=== Importing Skills ===\n");
  const entries = [];

  const dirs = ["ai-maestro", "ai-research", "analytics", "business-marketing", "career",
    "creative-design", "database", "design-to-code", "development", "document-processing",
    "enterprise-communication", "git", "gmod-addon-maker", "marketing", "media",
    "pocketbase", "productivity", "railway", "scientific", "security", "sentry",
    "sports", "utilities", "video", "web-data", "web-development", "workflow-automation"];

  for (const dir of dirs) {
    try {
      const items = await fetchJson(`${GITHUB_API}/skills/${dir}`);
      for (const item of items) {
        if (item.type !== "file" || !item.name.endsWith(".md") || item.name === "ANTHROPIC_ATTRIBUTION.md") continue;
        const content = await fetchText(item.download_url);
        const name = item.name.replace(/\.md$/, "");
        const category = CATEGORY_MAP[dir] || "productivity";
        const id = `aitmpl-${dir}-${name}`;

        const md = buildSkillMd(name, `A skill from aitmpl.com for ${dir}: ${name}`, null, content, category, `skills/${dir}/${name}`);
        const hash = sha256(md);
        const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));

        entries.push({
          id,
          name: slugToName(name),
          description: `${slugToName(name)} – AI-assisted development skill from aitmpl.com`,
          category,
          tier: "free",
          version: "1.0.0",
          downloadUrl: `${CDN_BASE}/${id}.md`,
          sha256: hash,
          sizeKb,
          keywords: [category, dir, "aitmpl", ...name.split(/[-_]/)],
          previewLines: extractPreviewLines(md),
        });

        writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
        console.log(`  skill: ${id}`);
      }
    } catch (err) {
      console.warn(`  ⚠ skills/${dir}: ${err.message}`);
    }
  }
  return entries;
}

async function importAgents() {
  console.log("\n=== Importing Agents ===\n");
  const entries = [];

  const dirs = ["accessibility", "ai-specialists", "api-graphql", "blockchain-web3",
    "business-marketing", "data-ai", "database", "deep-research-team", "development-team",
    "development-tools", "devops-infrastructure", "documentation", "expert-advisors",
    "ffmpeg-clip-team", "finance", "game-development", "git", "mcp-dev-team",
    "modernization", "obsidian-ops-team", "ocr-extraction-team", "performance-testing",
    "podcast-creator-team", "programming-languages", "realtime", "security",
    "ui-analysis", "web-tools"];

  for (const dir of dirs) {
    try {
      const items = await fetchJson(`${GITHUB_API}/agents/${dir}`);
      for (const item of items) {
        if (item.type !== "file" || !item.name.endsWith(".md")) continue;
        const content = await fetchText(item.download_url);
        const name = item.name.replace(/\.md$/, "");

        const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        let description = "";
        let toolsField = "";
        if (fmMatch) {
          const fm = fmMatch[1];
          const descMatch = fm.match(/description:\s*"([^"]*)"/);
          if (descMatch) description = descMatch[1];
          const toolsMatch = fm.match(/tools:\s*(.+)/);
          if (toolsMatch) toolsField = toolsMatch[1].trim();
        }

        const agentCategory = CATEGORY_MAP[dir] || "fullstack";
        const id = `aitmpl-agent-${dir}-${name}`;

        const md = buildSkillMd(`agent-${name}`, description || `${slugToName(name)} agent from aitmpl.com`, toolsField, content, agentCategory, `agents/${dir}/${name}`);
        const hash = sha256(md);
        const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));

        const tier = TIER_MAP[dir] || "pro";

        entries.push({
          id,
          name: `Agent: ${slugToName(name)}`,
          description: (description || `${slugToName(name)} – AI agent from aitmpl.com`).slice(0, 300),
          category: agentCategory,
          tier,
          version: "1.0.0",
          downloadUrl: `${CDN_BASE}/${id}.md`,
          sha256: hash,
          sizeKb,
          keywords: [agentCategory, dir, "agent", "aitmpl", ...name.split(/[-_]/)],
          previewLines: extractPreviewLines(md),
        });

        writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
        console.log(`  agent: ${id} (${sizeKb}KB)`);
      }
    } catch (err) {
      console.warn(`  ⚠ agents/${dir}: ${err.message}`);
    }
  }
  return entries;
}

async function importCommands() {
  console.log("\n=== Importing Commands ===\n");
  const entries = [];

  const dirs = ["analysis", "automation", "azure", "database", "deployment", "design",
    "documentation", "game-development", "git-workflow", "git", "google-workspace",
    "marketing", "nextjs-vercel", "orchestration", "performance", "project-management",
    "security", "setup", "simulation", "svelte", "sync", "team", "testing", "utilities"];

  for (const dir of dirs) {
    try {
      const items = await fetchJson(`${GITHUB_API}/commands/${dir}`);
      for (const item of items) {
        if (item.type !== "file" || !item.name.endsWith(".md")) continue;
        const content = await fetchText(item.download_url);
        const name = item.name.replace(/\.md$/, "");
        const category = CATEGORY_MAP[dir] || "productivity";
        const id = `aitmpl-cmd-${dir}-${name}`;

        const md = buildSkillMd(`cmd-${name}`, `Command from aitmpl.com: ${dir}/${name}`, null, content, category, `commands/${dir}/${name}`);
        const hash = sha256(md);
        const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));

        entries.push({
          id,
          name: `Cmd: ${slugToName(name)}`,
          description: `${slugToName(name)} – command template from aitmpl.com`,
          category,
          tier: "free",
          version: "1.0.0",
          downloadUrl: `${CDN_BASE}/${id}.md`,
          sha256: hash,
          sizeKb,
          keywords: [category, dir, "command", "aitmpl", ...name.split(/[-_]/)],
          previewLines: extractPreviewLines(md),
        });

        writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
        console.log(`  cmd: ${id}`);
      }
    } catch (err) {
      console.warn(`  ⚠ commands/${dir}: ${err.message}`);
    }
  }
  return entries;
}

async function importMCPs() {
  console.log("\n=== Importing MCPs ===\n");
  const entries = [];

  const dirs = ["audio", "browser_automation", "database", "deepgraph", "deepresearch",
    "devtools", "filesystem", "integration", "marketing", "productivity", "research",
    "web-data", "web"];

  for (const dir of dirs) {
    try {
      const items = await fetchJson(`${GITHUB_API}/mcps/${dir}`);
      for (const item of items) {
        if (item.type !== "file" || !item.name.endsWith(".json")) continue;
        const content = await fetchText(item.download_url);
        const name = item.name.replace(/\.json$/, "");
        const id = `aitmpl-mcp-${dir}-${name}`;

        let parsed;
        try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

        const serverDescs = parsed?.mcpServers
          ? Object.entries(parsed.mcpServers).map(([k, v]) => `- **${k}**: ${v.description || ""}`).join("\n")
          : "";

        const md = `---
name: mcp-${name}
description: "MCP server from aitmpl.com: ${dir}/${name}"
risk: safe
source: aitmpl
source_id: "mcps/${dir}/${name}"
category: "${CATEGORY_MAP[dir] || "integration"}"
tools: Read, Write, Edit
date_added: "2026-06-11"
---

# MCP: ${slugToName(name)}

## Description

${parsed?.mcpServers ? Object.values(parsed.mcpServers).map(s => s.description).filter(Boolean).join(". ") : `MCP server configuration for ${slugToName(name)}.`}

## Server Configuration

${serverDescs}

## Installation

Add this configuration to your project's \`.mcp.json\` file:

\`\`\`json
${JSON.stringify(parsed, null, 2)}
\`\`\`

## Source

https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/mcps/${dir}/${item.name}
`;

        const hash = sha256(md);
        const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));
        const description = parsed?.mcpServers
          ? Object.values(parsed.mcpServers).map(s => s.description).filter(Boolean).join(". ") || `${slugToName(name)} MCP server`
          : `${slugToName(name)} MCP server`;

        entries.push({
          id,
          name: `MCP: ${slugToName(name)}`,
          description: description.slice(0, 300),
          category: CATEGORY_MAP[dir] || "integration",
          tier: "pro",
          version: "1.0.0",
          downloadUrl: `${CDN_BASE}/${id}.md`,
          sha256: hash,
          sizeKb,
          keywords: [CATEGORY_MAP[dir] || "integration", dir, "mcp", "aitmpl", ...name.split(/[-_]/)],
          previewLines: extractPreviewLines(md),
        });

        writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
        console.log(`  mcp: ${id} (${description.slice(0, 60)}...)`);
      }
    } catch (err) {
      console.warn(`  ⚠ mcps/${dir}: ${err.message}`);
    }
  }
  return entries;
}

async function importHooks() {
  console.log("\n=== Importing Hooks ===\n");
  const entries = [];

  const dirs = ["analysis", "automation", "deployment", "design", "development",
    "git", "notification", "security", "testing"];

  for (const dir of dirs) {
    try {
      const items = await fetchJson(`${GITHUB_API}/hooks/${dir}`);
      for (const item of items) {
        if (item.type !== "file") continue;
        const content = await fetchText(item.download_url);
        const name = item.name.replace(/\.(py|sh|js|ts|ps1)$/, "");
        const category = CATEGORY_MAP[dir] || "devops";
        const id = `aitmpl-hook-${dir}-${name}`;

        const md = buildSkillMd(`hook-${name}`, `Hook/script from aitmpl.com: ${dir}/${item.name}`, null,
          "## Description\n\nAutomation hook from aitmpl.com\n\n## Script\n\n```\n" + content + "\n```\n\n## Usage\n\nThis hook is designed to be used as an automation trigger in your development workflow.",
          category, `hooks/${dir}/${item.name}`);
        const hash = sha256(md);
        const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));

        entries.push({
          id,
          name: `Hook: ${slugToName(name)}`,
          description: `Automation hook from aitmpl.com: ${dir}/${item.name}`,
          category,
          tier: "free",
          version: "1.0.0",
          downloadUrl: `${CDN_BASE}/${id}.md`,
          sha256: hash,
          sizeKb,
          keywords: [category, dir, "hook", "automation", "aitmpl", ...name.split(/[-_]/)],
          previewLines: extractPreviewLines(md),
        });

        writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
        console.log(`  hook: ${id}`);
      }
    } catch (err) {
      console.warn(`  ⚠ hooks/${dir}: ${err.message}`);
    }
  }
  return entries;
}

async function importSettings() {
  console.log("\n=== Importing Settings ===\n");
  const entries = [];

  const dirs = ["development", "security", "performance", "team", "project"];

  for (const dir of dirs) {
    try {
      const items = await fetchJson(`${GITHUB_API}/settings/${dir}`);
      for (const item of items) {
        if (item.type !== "file") continue;
        const content = await fetchText(item.download_url);
        const name = item.name.replace(/\.(json|md)$/, "");
        const category = CATEGORY_MAP[dir] || "productivity";
        const id = `aitmpl-setting-${dir}-${name}`;

        const md = buildSkillMd(`setting-${name}`, `Configuration setting from aitmpl.com: ${dir}/${item.name}`, null,
          "## Description\n\nConfiguration template from aitmpl.com\n\n## Content\n\n```\n" + content + "\n```\n\n## Usage\n\nApply this configuration to your development environment.",
          category, `settings/${dir}/${item.name}`);
        const hash = sha256(md);
        const sizeKb = Math.max(1, Math.round(Buffer.byteLength(md, "utf-8") / 1024));

        entries.push({
          id,
          name: `Setting: ${slugToName(name)}`,
          description: `Configuration from aitmpl.com: ${dir}/${item.name}`,
          category,
          tier: "free",
          version: "1.0.0",
          downloadUrl: `${CDN_BASE}/${id}.md`,
          sha256: hash,
          sizeKb,
          keywords: [category, dir, "setting", "configuration", "aitmpl", ...name.split(/[-_]/)],
          previewLines: extractPreviewLines(md),
        });

        writeFileSync(join(OC_SKILLS_DIR, `${id}.md`), md, "utf-8");
        console.log(`  setting: ${id}`);
      }
    } catch (err) {
      console.warn(`  ⚠ settings/${dir}: ${err.message}`);
    }
  }
  return entries;
}

function deduplicate(existing, incoming) {
  const existingIds = new Set(existing.map((s) => s.id));
  const duplicates = [];
  const newItems = [];
  for (const item of incoming) {
    if (existingIds.has(item.id)) {
      duplicates.push(item.id);
    } else {
      newItems.push(item);
      existingIds.add(item.id);
    }
  }
  return { newItems, duplicates };
}

function generateFallback(catalog) {
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
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Oclushion aitmpl.com Catalog Import        ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  mkdirSync(OC_SKILLS_DIR, { recursive: true });
  mkdirSync(OC_TOOLS_DIR, { recursive: true });

  let catalog = { skills: [], tools: [] };
  if (existsSync(OC_CATALOG)) {
    try {
      catalog = JSON.parse(readFileSync(OC_CATALOG, "utf-8"));
    } catch (e) {
      console.warn("⚠ Could not read existing catalog, starting fresh");
    }
  }

  const existingCount = catalog.skills.length;
  console.log(`Existing catalog: ${existingCount} skills, ${catalog.tools.length} tools\n`);

  const skillEntries = await importSkills();
  const agentEntries = await importAgents();
  const commandEntries = await importCommands();
  const hookEntries = await importHooks();
  const settingEntries = await importSettings();
  const mcpEntries = await importMCPs();

  const allIncoming = [...skillEntries, ...agentEntries, ...commandEntries, ...hookEntries, ...settingEntries, ...mcpEntries];
  const { newItems, duplicates } = deduplicate(catalog.skills, allIncoming);

  console.log(`\n=== Results ===`);
  console.log(`  Skills from aitmpl: ${skillEntries.length}`);
  console.log(`  Agents from aitmpl: ${agentEntries.length}`);
  console.log(`  Commands from aitmpl: ${commandEntries.length}`);
  console.log(`  Hooks from aitmpl: ${hookEntries.length}`);
  console.log(`  Settings from aitmpl: ${settingEntries.length}`);
  console.log(`  MCPs from aitmpl: ${mcpEntries.length}`);
  console.log(`  ---`);
  console.log(`  Total incoming skills: ${allIncoming.length}`);
  console.log(`  Duplicates skipped: ${duplicates.length}`);
  console.log(`  New skills to add: ${newItems.length}`);

  catalog.skills = [...catalog.skills, ...newItems];

  writeFileSync(OC_CATALOG, JSON.stringify(catalog, null, 2));
  console.log(`\n✓ Catalog updated: ${catalog.skills.length} skills (+${newItems.length}), ${catalog.tools.length} tools`);

  generateFallback(catalog);
  console.log(`✓ Fallback catalog regenerated`);

  console.log(`\n✓ Done!`);
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err.message);
  process.exit(1);
});
