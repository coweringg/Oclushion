#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const catalog = JSON.parse(readFileSync(join(ROOT, "docker/data/marketplace/v1/catalog.json"), "utf-8"));

const fallback = `// ⚡ Auto-generated — DO NOT EDIT
import type { Skill, AiTool, MarketplaceCatalog } from "./marketplace.types";

const skills: Skill[] = ${JSON.stringify(catalog.skills, null, 2)};

const tools: AiTool[] = ${JSON.stringify(catalog.tools, null, 2)};

function validateFallbackCatalog(): MarketplaceCatalog {
  return { skills, tools };
}

export const FALLBACK_CATALOG = validateFallbackCatalog();
`;

writeFileSync(join(ROOT, "apps/desktop-shell/src/marketplace/fallback-catalog.ts"), fallback, "utf-8");
console.log(`✓ fallback-catalog.ts generated (${catalog.skills.length} skills, ${catalog.tools.length} tools)`);
