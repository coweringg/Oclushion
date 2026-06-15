import { describe, expect, it, vi, beforeEach } from "vitest";
import * as org from "./organization.service";
import * as skills from "./enterprise-skill.service";
import * as agents from "./enterprise-agent.service";
import * as hooks from "./enterprise-hook.service";
import {
  buildUnifiedSkillList,
  searchUnifiedSkills,
  filterUnifiedBySource,
  filterUnifiedByCategory,
  getApprovedAgents,
  getApprovedHooks,
  buildEnterpriseSkillsContext,
  buildEnterpriseAgentsContext,
} from "./unified-registry.service";
import type { MarketplaceCatalog, Skill } from "../marketplace/marketplace.types";
import type { EnterpriseSkill, EnterpriseAgent, EnterpriseHook } from "../types/enterprise-registry";

vi.mock("./organization.service", () => ({
  getOrganization: vi.fn(),
}));

vi.mock("./enterprise-skill.service", () => ({
  getCachedSkills: vi.fn(),
  subscribeToSkills: vi.fn(() => () => {}),
  fetchSkills: vi.fn(),
}));

vi.mock("./enterprise-agent.service", () => ({
  getCachedAgents: vi.fn(),
  subscribeToAgents: vi.fn(() => () => {}),
  fetchAgents: vi.fn(),
}));

vi.mock("./enterprise-hook.service", () => ({
  getCachedHooks: vi.fn(),
  subscribeToHooks: vi.fn(() => () => {}),
  fetchHooks: vi.fn(),
}));

const publicSkills: Skill[] = [
  {
    id: "pub_1",
    name: "Fullstack Staff",
    description: "Fullstack development",
    category: "fullstack",
    tier: "free",
    version: "1.0.0",
    downloadUrl: "https://cdn.oclushion.com/skills/fullstack.md",
    sha256: "abc123",
    sizeKb: 10,
    keywords: ["fullstack"],
    previewLines: ["# Fullstack"],
  },
  {
    id: "pub_2",
    name: "Security OWASP",
    description: "OWASP security rules",
    category: "security",
    tier: "pro",
    version: "2.0.0",
    downloadUrl: "https://cdn.oclushion.com/skills/security.md",
    sha256: "def456",
    sizeKb: 15,
    keywords: ["security", "owasp"],
    previewLines: ["# Security"],
  },
];

const enterpriseSkills: EnterpriseSkill[] = [
  {
    id: "es_1",
    orgId: "org_1",
    name: "Acme Code Style",
    description: "Acme coding standards",
    category: "fullstack",
    version: "1.0.0",
    content: "# Acme Style\n\nUse strict TypeScript.",
    sha256: "abc123",
    createdBy: "u1",
    status: "approved",
    visibility: "org",
    tags: ["style"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "es_2",
    orgId: "org_1",
    name: "Custom API Rules",
    description: "Internal API conventions",
    category: "backend",
    version: "1.0.0",
    content: "# API Rules\n\nResource-based URLs.",
    sha256: "ghi789",
    createdBy: "u2",
    status: "approved",
    visibility: "org",
    tags: ["api"],
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "es_3",
    orgId: "org_1",
    name: "Draft Skill",
    description: "Not yet approved",
    category: "frontend",
    version: "1.0.0",
    content: "# Draft",
    sha256: "jkl012",
    createdBy: "u3",
    status: "draft",
    visibility: "org",
    tags: [],
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
];

const enterpriseAgents: EnterpriseAgent[] = [
  {
    id: "ea_1",
    orgId: "org_1",
    name: "Code Reviewer",
    description: "Reviews code",
    role: "code-reviewer",
    systemPrompt: "Review code for Acme standards.",
    skillIds: ["es_1"],
    mcpIds: [],
    status: "approved",
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const enterpriseHooks: EnterpriseHook[] = [
  {
    id: "eh_1",
    orgId: "org_1",
    name: "Lint on Save",
    description: "Run linter after save",
    event: "post-save",
    action: { type: "run-command", command: "pnpm lint" },
    enabled: true,
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

function mockOrg() {
  return vi.spyOn(org, "getOrganization").mockReturnValue({
    id: "org_1",
    name: "Acme Corp",
    slug: "acme",
    plan: "enterprise",
    createdAt: "2026-01-01T00:00:00.000Z",
    settings: {
      allowMemberUploads: true,
      requireAdminApproval: true,
      allowedCategories: ["fullstack"],
      maxSkillsPerOrg: 500,
    },
  });
}

describe("UnifiedRegistryService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildUnifiedSkillList", () => {
    it("merges org skills with public skills", () => {
      mockOrg();
      vi.spyOn(skills, "getCachedSkills").mockReturnValue(enterpriseSkills);
      vi.spyOn(agents, "getCachedAgents").mockReturnValue([]);
      vi.spyOn(hooks, "getCachedHooks").mockReturnValue([]);

      const catalog: MarketplaceCatalog = { skills: publicSkills, tools: [] };
      const unified = buildUnifiedSkillList(catalog, [], new Map());

      expect(unified.length).toBeGreaterThanOrEqual(3);
    });

    it("marks org source correctly", () => {
      mockOrg();
      vi.spyOn(skills, "getCachedSkills").mockReturnValue(enterpriseSkills);
      vi.spyOn(agents, "getCachedAgents").mockReturnValue([]);
      vi.spyOn(hooks, "getCachedHooks").mockReturnValue([]);

      const catalog: MarketplaceCatalog = { skills: publicSkills, tools: [] };
      const unified = buildUnifiedSkillList(catalog, [], new Map());

      const orgItems = unified.filter((u) => u.source === "org");
      expect(orgItems.length).toBeGreaterThanOrEqual(2);
    });

    it("filters out draft enterprise skills", () => {
      mockOrg();
      vi.spyOn(skills, "getCachedSkills").mockReturnValue(enterpriseSkills);
      vi.spyOn(agents, "getCachedAgents").mockReturnValue([]);
      vi.spyOn(hooks, "getCachedHooks").mockReturnValue([]);

      const catalog: MarketplaceCatalog = { skills: publicSkills, tools: [] };
      const unified = buildUnifiedSkillList(catalog, [], new Map());

      const draftItems = unified.filter((u) => u.enterpriseSkill?.status === "draft");
      expect(draftItems).toHaveLength(0);
    });

    it("returns public skills when no org", () => {
      vi.spyOn(org, "getOrganization").mockReturnValue(null);

      const catalog: MarketplaceCatalog = { skills: publicSkills, tools: [] };
      const unified = buildUnifiedSkillList(catalog, [], new Map());

      expect(unified).toHaveLength(2);
      expect(unified.every((u) => u.source === "public")).toBe(true);
    });
  });

  describe("searchUnifiedSkills", () => {
    it("searches across both sources", () => {
      mockOrg();
      vi.spyOn(skills, "getCachedSkills").mockReturnValue(enterpriseSkills);
      vi.spyOn(agents, "getCachedAgents").mockReturnValue([]);
      vi.spyOn(hooks, "getCachedHooks").mockReturnValue([]);

      const catalog: MarketplaceCatalog = { skills: publicSkills, tools: [] };
      const unified = buildUnifiedSkillList(catalog, [], new Map());

      const results = searchUnifiedSkills(unified, "security");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("filterUnifiedBySource", () => {
    it("filters by org source", () => {
      mockOrg();
      vi.spyOn(skills, "getCachedSkills").mockReturnValue(enterpriseSkills);
      vi.spyOn(agents, "getCachedAgents").mockReturnValue([]);
      vi.spyOn(hooks, "getCachedHooks").mockReturnValue([]);

      const catalog: MarketplaceCatalog = { skills: publicSkills, tools: [] };
      const unified = buildUnifiedSkillList(catalog, [], new Map());

      const orgOnly = filterUnifiedBySource(unified, "org");
      expect(orgOnly.every((u) => u.source === "org")).toBe(true);
    });

    it("filters by public source", () => {
      mockOrg();
      vi.spyOn(skills, "getCachedSkills").mockReturnValue(enterpriseSkills);
      vi.spyOn(agents, "getCachedAgents").mockReturnValue([]);
      vi.spyOn(hooks, "getCachedHooks").mockReturnValue([]);

      const catalog: MarketplaceCatalog = { skills: publicSkills, tools: [] };
      const unified = buildUnifiedSkillList(catalog, [], new Map());

      const publicOnly = filterUnifiedBySource(unified, "public");
      expect(publicOnly.every((u) => u.source === "public")).toBe(true);
    });
  });

  describe("filterUnifiedByCategory", () => {
    it("filters by category", () => {
      mockOrg();
      vi.spyOn(skills, "getCachedSkills").mockReturnValue(enterpriseSkills);
      vi.spyOn(agents, "getCachedAgents").mockReturnValue([]);
      vi.spyOn(hooks, "getCachedHooks").mockReturnValue([]);

      const catalog: MarketplaceCatalog = { skills: publicSkills, tools: [] };
      const unified = buildUnifiedSkillList(catalog, [], new Map());

      const security = filterUnifiedByCategory(unified, "security");
      expect(security.every((u) => u.skill.category === "security")).toBe(true);
    });
  });

  describe("getApprovedAgents", () => {
    it("returns only approved agents", () => {
      mockOrg();
      vi.spyOn(agents, "getCachedAgents").mockReturnValue(enterpriseAgents);
      const approved = getApprovedAgents();
      expect(approved).toHaveLength(1);
    });

    it("returns empty when no org", () => {
      vi.spyOn(org, "getOrganization").mockReturnValue(null);
      const approved = getApprovedAgents();
      expect(approved).toHaveLength(0);
    });
  });

  describe("getApprovedHooks", () => {
    it("returns enabled hooks", () => {
      mockOrg();
      vi.spyOn(hooks, "getCachedHooks").mockReturnValue(enterpriseHooks);
      const approved = getApprovedHooks();
      expect(approved).toHaveLength(1);
    });
  });

  describe("buildEnterpriseSkillsContext", () => {
    it("builds XML context from approved skills", () => {
      mockOrg();
      vi.spyOn(skills, "getCachedSkills").mockReturnValue(enterpriseSkills);
      const context = buildEnterpriseSkillsContext();
      expect(context).toContain("<enterprise_skills");
      expect(context).toContain("Acme Corp");
      expect(context).toContain("Acme Code Style");
      expect(context).toContain("Custom API Rules");
      expect(context).not.toContain("Draft Skill");
    });

    it("returns empty when no org", () => {
      vi.spyOn(org, "getOrganization").mockReturnValue(null);
      const context = buildEnterpriseSkillsContext();
      expect(context).toBe("");
    });
  });

  describe("buildEnterpriseAgentsContext", () => {
    it("builds XML context from approved agents", () => {
      mockOrg();
      vi.spyOn(agents, "getCachedAgents").mockReturnValue(enterpriseAgents);
      const context = buildEnterpriseAgentsContext();
      expect(context).toContain("<enterprise_agents");
      expect(context).toContain("Acme Corp");
      expect(context).toContain("Code Reviewer");
    });

    it("returns empty when no org", () => {
      vi.spyOn(org, "getOrganization").mockReturnValue(null);
      const context = buildEnterpriseAgentsContext();
      expect(context).toBe("");
    });
  });
});
