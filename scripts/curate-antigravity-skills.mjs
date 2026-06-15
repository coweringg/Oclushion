#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const ANTIGRAVITY_DIR = join(ROOT, "..", "..", "AppData", "Local", "Temp", "opencode", "antigravity-awesome-skills");
const SKILLS_DIR = join(ANTIGRAVITY_DIR, "skills");
const INDEX_PATH = join(ANTIGRAVITY_DIR, "data", "skills_index.json");
const BUNDLES_PATH = join(ANTIGRAVITY_DIR, "data", "editorial-bundles.json");

const OCLUSHION_SKILLS_DIR = join(ROOT, "docker", "data", "marketplace", "v1", "skills");
const OCLUSHION_CATALOG_PATH = join(ROOT, "docker", "data", "marketplace", "v1", "catalog.json");
const OCLUSHION_FALLBACK_PATH = join(ROOT, "apps", "desktop-shell", "src", "marketplace", "fallback-catalog.ts");

const CDN_BASE = "https://cdn.oclushion.com/marketplace/v1/skills";

const CATEGORY_MAP = {
  frontend: "frontend",
  "front-end": "frontend",
  design: "design",
  "web-development": "frontend",
  backend: "backend",
  "api-integration": "backend",
  database: "backend",
  devops: "devops",
  cloud: "devops",
  reliability: "devops",
  security: "security",
  testing: "testing",
  "test-automation": "testing",
  "ai-ml": "ai",
  "ai-agents": "ai",
  "ai-research": "ai",
  "prompt-engineering": "ai",
  "ai-testing": "ai",
  data: "data",
  "data-science": "data",
  "data-engineering": "data",
  architecture: "architecture",
  "code-quality": "code-review",
  "developer-tools": "fullstack",
  fullstack: "fullstack",
  mobile: "mobile",
  productivity: "productivity",
  automation: "productivity",
  workflow: "productivity",
  research: "research",
  science: "research",
  writing: "documentation",
  coding: "code-review",
  planning: "productivity",
  "project-management": "productivity",
  "product-management": "productivity",
  marketing: "productivity",
  growth: "productivity",
  seo: "productivity",
  business: "productivity",
  "personal-development": "productivity",
  "context-optimization": "ai",
  orchestration: "ai",
  mcp: "ai",
  "agent-behavior": "ai",
  "agent-orchestration": "ai",
  "voice-agents": "ai",
  "browser-automation": "testing",
  "game-development": "frontend",
  media: "design",
  creative: "design",
  content: "design",
  collaboration: "productivity",
  education: "research",
  finance: "data",
  legal: "documentation",
  "document-processing": "productivity",
  "spreadsheet-processing": "data",
  "presentation-processing": "design",
  "graphics-processing": "design",
  "media-processing": "design",
  blockchain: "backend",
  ecommerce: "backend",
  health: "research",
  uncategorized: "productivity",
};

const TIER_MAP = {
  enterprise: "enterprise",
  pro: "pro",
  free: "free",
};

const TRUSTED_SOURCES = new Set([
  "official",
  "personal",
  "self",
  "original",
]);

const TRUSTED_URL_PREFIXES = [
  "https://github.com/huggingface/",
  "https://github.com/vercel-labs/",
  "https://github.com/expo/",
  "https://github.com/shadcn-ui/",
  "https://github.com/playwright-community/",
  "https://github.com/biopython/",
  "https://github.com/networkx/",
  "https://github.com/sympy/",
  "https://github.com/astropy/",
  "https://github.com/neondatabase/",
];

const TIERED_CATEGORIES = {
  security: { free: ["code-review", "basic"], pro: ["pentest", "advanced"], enterprise: ["enterprise-netsec"] },
  ai: { free: ["prompt-engineering"], pro: ["agent-dev", "mcp"], enterprise: ["llm-eval"] },
  devops: { free: ["docker", "ci-basic"], pro: ["ci-advanced"], enterprise: ["aws", "terraform"] },
  data: { free: ["basic"], pro: ["pipeline"], enterprise: [] },
  architecture: { free: [], pro: ["typescript", "system-design"], enterprise: [] },
};

function sha256(filePath) {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function slugToName(slug) {
  return slug
    .split(/[-_]/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractPreviewLines(content) {
  return content
    .split("\n")
    .slice(0, 5)
    .filter((l) => l.trim() && !l.startsWith("---"));
}

function mapSkill(entry, category, bundleInfo) {
  const skillDir = join(SKILLS_DIR, entry.id);
  const skillFilePath = join(skillDir, "SKILL.md");

  if (!existsSync(skillFilePath)) return null;

  const rawContent = readFileSync(skillFilePath, "utf-8");
  const hash = sha256(skillFilePath);
  const sizeKb = Math.round(Buffer.byteLength(rawContent, "utf-8") / 1024);

  const desc = entry.description
    ? entry.description.replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
    : `${slugToName(entry.id)} skill for AI-assisted development.`;

  const oclushionCategory = CATEGORY_MAP[category] || "productivity";
  let oclushionTier = "free";

  if (entry.risk === "critical" || entry.source === "enterprise") {
    oclushionTier = "enterprise";
  } else if (category === "security" || category === "ai-ml" || category === "ai-agents" || category === "devops" || category === "data-engineering") {
    oclushionTier = "pro";
  }

  return {
    id: entry.id,
    name: slugToName(entry.id),
    description: desc,
    category: oclushionCategory,
    tier: oclushionTier,
    version: "1.0.0",
    downloadUrl: `${CDN_BASE}/${entry.id}.md`,
    sha256: hash,
    sizeKb: Math.max(1, sizeKb),
    keywords: [category, ...(bundleInfo ? [bundleInfo] : []), ...desc.split(/\s+/).filter((w) => w.length > 4).slice(0, 5).map((w) => w.toLowerCase().replace(/[^a-z0-9-]/g, ""))],
    previewLines: extractPreviewLines(rawContent),
  };
}

function curate() {
  console.log("=== Curating skills from antigravity-awesome-skills ===\n");

  const index = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
  const byId = new Map(index.map((e) => [e.id, e]));

  const bundlesData = JSON.parse(readFileSync(BUNDLES_PATH, "utf-8"));
  const bundledSkillIds = new Set();
  const bundleInfo = new Map();

  for (const bundle of bundlesData.bundles) {
    for (const s of bundle.skills) {
      bundledSkillIds.add(s.id);
      bundleInfo.set(s.id, bundle.id);
    }
  }

  console.log(`Editorial bundles: ${bundlesData.bundles.length}`);
  console.log(`Bundled skills: ${bundledSkillIds.size}`);
  console.log(`Total in index: ${index.length}\n`);

  const selected = new Map();

  for (const id of bundledSkillIds) {
    const entry = byId.get(id);
    if (!entry) continue;
    const cat = CATEGORY_MAP[entry.category] || "productivity";
    const skill = mapSkill(entry, entry.category, bundleInfo.get(id));
    if (skill) {
      selected.set(id, skill);
    }
  }

  console.log(`After pass 1 (bundles): ${selected.size} skills`);

  const categoriesNeeded = ["frontend", "backend", "devops", "security", "testing", "ai", "data", "architecture", "fullstack", "mobile", "design", "productivity", "research", "documentation", "code-review"];

  for (const cat of categoriesNeeded) {
    const currentInCat = [...selected.values()].filter((s) => s.category === cat).length;
    const targetPerCategory = {
      frontend: 8, backend: 8, devops: 7, security: 7, testing: 6,
      ai: 8, data: 5, architecture: 5, fullstack: 5, mobile: 4,
      design: 6, productivity: 8, research: 4, documentation: 3, "code-review": 4,
    };
    const target = targetPerCategory[cat] || 5;
    const needed = target - currentInCat;

    if (needed <= 0) continue;

    const candidates = index
      .filter((e) => {
        if (selected.has(e.id)) return false;
        if (CATEGORY_MAP[e.category] !== cat) return false;
        if (e.risk === "offensive") return false;
        return true;
      })
      .sort((a, b) => {
        const aTrusted = a.risk === "safe" ? 2 : a.risk === "critical" ? 1 : 0;
        const bTrusted = b.risk === "safe" ? 2 : b.risk === "critical" ? 1 : 0;
        return bTrusted - aTrusted;
      });

    let added = 0;
    for (const candidate of candidates) {
      if (added >= needed) break;
      const skill = mapSkill(candidate, candidate.category, null);
      if (skill) {
        selected.set(candidate.id, skill);
        added++;
      }
    }

    if (added > 0) {
      console.log(`  Filled ${cat}: +${added} (total: ${currentInCat + added})`);
    }
  }

  console.log(`\nTotal selected: ${selected.size} skills`);

  const dist = {};
  for (const s of selected.values()) {
    dist[s.category] = (dist[s.category] || 0) + 1;
  }
  console.log("\nDistribution:");
  for (const [cat, count] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  mkdirSync(OCLUSHION_SKILLS_DIR, { recursive: true });
  let written = 0;
  for (const [id] of selected) {
    const srcPath = join(SKILLS_DIR, id, "SKILL.md");
    if (!existsSync(srcPath)) continue;
    const destPath = join(OCLUSHION_SKILLS_DIR, `${id}.md`);
    writeFileSync(destPath, readFileSync(srcPath));
    written++;
  }
  console.log(`\nWritten SKILL.md files: ${written}/${selected.size}`);

  let existingCatalog = { skills: [], tools: [] };
  if (existsSync(OCLUSHION_CATALOG_PATH)) {
    try {
      existingCatalog = JSON.parse(readFileSync(OCLUSHION_CATALOG_PATH, "utf-8"));
    } catch {}
  }

  const existingSkillIds = new Set(existingCatalog.skills.map((s) => s.id));

  const mergedSkills = [...existingCatalog.skills];
  for (const [id, skill] of selected) {
    if (!existingSkillIds.has(id)) {
      mergedSkills.push(skill);
    }
  }

  const catalog = {
    skills: mergedSkills,
    tools: existingCatalog.tools || [],
  };

  writeFileSync(OCLUSHION_CATALOG_PATH, JSON.stringify(catalog, null, 2));
  console.log(`Catalog: ${mergedSkills.length} skills (${existingCatalog.skills.length} existing + ${mergedSkills.length - existingCatalog.skills.length} new)`);

  const fallbackContent = `// ⚡ Auto-generated — DO NOT EDIT
import type { Skill, AiTool, MarketplaceCatalog } from "./marketplace.types";

const skills: Skill[] = ${JSON.stringify(catalog.skills, null, 2)};

const tools: AiTool[] = ${JSON.stringify(catalog.tools, null, 2)};

function validateFallbackCatalog(): MarketplaceCatalog {
  return { skills, tools };
}

export const FALLBACK_CATALOG = validateFallbackCatalog();
`;

  writeFileSync(OCLUSHION_FALLBACK_PATH, fallbackContent);
  console.log(`Fallback catalog updated: ${catalog.skills.length} skills`);

  console.log("\n✓ Done!");
}

curate();
