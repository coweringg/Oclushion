import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { s } from "./schema-helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = process.env.MARKETPLACE_CATALOG_DIR ?? join(__dirname, "../../../docker/data/marketplace/v1");
const CATALOG_PATH = process.env.MARKETPLACE_CATALOG_PATH ?? join(CATALOG_DIR, "catalog.json");
const SKILLS_DIR = process.env.MARKETPLACE_SKILLS_DIR ?? join(CATALOG_DIR, "skills");
const CACHE_MAX_AGE = 3600;

type SkillEntry = {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  version: string;
  downloadUrl: string;
  sha256: string;
  sizeKb: number;
  keywords: string[];
  previewLines: string[];
  stats?: { downloads: number; rating: number };
};

type ToolEntry = {
  id: string;
  name: string;
  description: string;
  version: string;
  downloadUrl: string;
  platform: string;
  requiredBin: string;
  gitignoreEntry: string;
  sha256: string;
};

type Catalog = {
  version: string;
  updated: string;
  skills: SkillEntry[];
  tools: ToolEntry[];
};

let currentCatalog: Catalog | null = null;

function loadCatalog(): Catalog {
  const fallback: Catalog = { version: "1.0.0", updated: new Date().toISOString(), skills: [], tools: [] };
  if (!existsSync(CATALOG_PATH)) {
    return fallback;
  }
  try {
    const raw = readFileSync(CATALOG_PATH, "utf-8");
    return JSON.parse(raw) as Catalog;
  } catch {
    return fallback;
  }
}

function getCatalog(): Catalog {
  if (!currentCatalog) {
    currentCatalog = loadCatalog();
  }
  return currentCatalog;
}

function generateSignature(catalog: Catalog): string {
  const hmac = createHmac("sha256", process.env.CATALOG_SECRET_KEY ?? "default-secret");
  hmac.update(JSON.stringify(catalog));
  return hmac.digest("hex");
}

export async function marketplaceRoutes(fastify: FastifyInstance) {
  fastify.get("/catalog", {
    schema: s(["Marketplace"], "Get full skill and tool catalog", "marketplaceGetCatalog", {
      response: {
        200: {
          type: "object",
          properties: {
            version: { type: "string" },
            updated: { type: "string", format: "date-time" },
            skills: { type: "array", items: { type: "object" } },
            tools: { type: "array", items: { type: "object" } },
          },
        },
        304: { description: "Not modified (ETag match)" },
      },
    }),
  }, async (request, reply) => {
    const catalog = getCatalog();
    const clientEtag = request.headers["if-none-match"];
    const signature = generateSignature(catalog);

    if (clientEtag === `"${signature}"`) {
      return reply.status(304).send();
    }

    return reply
      .header("ETag", `"${signature}"`)
      .header("Cache-Control", `public, max-age=${CACHE_MAX_AGE}`)
      .header("X-Catalog-Version", catalog.version)
      .send(catalog);
  });

  fastify.get("/skills/:id/content", {
    schema: s(["Marketplace"], "Get skill content as markdown", "marketplaceGetSkillContent", {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", description: "Skill ID" } },
      },
    }),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const catalog = getCatalog();
    const skill = catalog.skills.find((s) => s.id === id);
    if (!skill) {
      return reply.status(404).send({ error: "Skill not found" });
    }

    const skillPath = join(SKILLS_DIR, `${id}.md`);
    if (!existsSync(skillPath)) {
      return reply.status(404).send({ error: "Skill content not found" });
    }

    const content = readFileSync(skillPath, "utf-8");
    return reply
      .header("Content-Type", "text/markdown; charset=utf-8")
      .header("ETag", `"${skill.sha256}"`)
      .header("Access-Control-Allow-Origin", "*")
      .send(content);
  });

  fastify.get("/skills/:id/download", {
    schema: s(["Marketplace"], "Download skill as markdown attachment", "marketplaceDownloadSkill", {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", description: "Skill ID" } },
      },
    }),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const catalog = getCatalog();
    const skill = catalog.skills.find((s) => s.id === id);
    if (!skill) {
      return reply.status(404).send({ error: "Skill not found" });
    }

    const skillPath = join(SKILLS_DIR, `${id}.md`);
    if (!existsSync(skillPath)) {
      return reply.status(404).send({ error: "Skill content not found" });
    }

    const content = readFileSync(skillPath, "utf-8");

    if (skill.stats) {
      skill.stats.downloads++;
      catalog.updated = new Date().toISOString();
    }

    return reply
      .header("Content-Type", "text/markdown; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${id}.md"`)
      .header("Access-Control-Allow-Origin", "*")
      .send(content);
  });

  fastify.get("/skills/:id", {
    schema: s(["Marketplace"], "Get skill metadata by ID", "marketplaceGetSkill", {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", description: "Skill ID" } },
      },
    }),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const catalog = getCatalog();
    const skill = catalog.skills.find((s) => s.id === id);
    if (!skill) {
      return reply.status(404).send({ error: "Skill not found" });
    }
    return reply.send(skill);
  });

  fastify.post("/skills/:id/download", {
    schema: s(["Marketplace"], "Increment skill download count", "marketplaceIncrementDownload", {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", description: "Skill ID" } },
      },
    }),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const catalog = getCatalog();
    const skill = catalog.skills.find((s) => s.id === id);
    if (!skill) {
      return reply.status(404).send({ error: "Skill not found" });
    }

    if (!skill.stats) {
      (skill as Record<string, unknown>).stats = { downloads: 0, rating: 0 };
    }
    skill.stats!.downloads++;
    catalog.updated = new Date().toISOString();

    return reply.send({ ok: true, downloads: skill.stats!.downloads });
  });

  fastify.get("/skillpacks", {
    schema: s(["Marketplace"], "List enterprise skillpacks", "marketplaceListSkillpacks"),
  }, async (request, reply) => {
    return reply.send({ skillpacks: [] });
  });

  fastify.post("/catalog/refresh", {
    schema: s(["Marketplace"], "Refresh catalog from disk (admin only)", "marketplaceRefreshCatalog"),
  }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const token = authHeader.slice(7);
    if (token !== process.env.ADMIN_API_TOKEN) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    currentCatalog = loadCatalog();
    currentCatalog!.updated = new Date().toISOString();
    currentCatalog!.version = bumpVersion(currentCatalog!.version);

    return reply.send({ ok: true, version: currentCatalog!.version });
  });
}

function bumpVersion(version: string): string {
  const parts = version.split(".").map(Number);
  parts[2] = (parts[2] ?? 0) + 1;
  return parts.join(".");
}

export async function marketplaceAdminRoutes(fastify: FastifyInstance) {
}
