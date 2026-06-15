import { describe, expect, it, vi, beforeEach } from "vitest";
import * as api from "./enterprise-api.service";
import * as org from "./organization.service";
import {
  fetchSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  approveSkill,
  filterSkillsByStatus,
  searchSkills,
  getCachedSkills,
  subscribeToSkills,
} from "./enterprise-skill.service";
import type { EnterpriseSkill } from "../types/enterprise-registry";

vi.mock("./enterprise-api.service", () => ({
  enterpriseApi: vi.fn(),
}));

vi.mock("./organization.service", () => ({
  getOrganization: vi.fn(),
}));

function mockApi<T>(data: T, ok = true) {
  return vi.spyOn(api, "enterpriseApi").mockResolvedValue({ ok, status: ok ? 200 : 400, data });
}

function mockOrg(id = "org_1") {
  return vi.spyOn(org, "getOrganization").mockReturnValue({
    id,
    name: "Acme",
    slug: "acme",
    plan: "enterprise",
    createdAt: "2026-01-01T00:00:00.000Z",
    settings: {
      allowMemberUploads: true,
      requireAdminApproval: true,
      allowedCategories: ["fullstack", "frontend", "backend"],
      maxSkillsPerOrg: 500,
    },
  });
}

const mockSkills: EnterpriseSkill[] = [
  {
    id: "es_1",
    orgId: "org_1",
    name: "Code Style Guide",
    description: "Acme coding standards",
    category: "fullstack",
    version: "1.0.0",
    content: "# Code Style\n\nUse TypeScript strict mode.",
    sha256: "abc123",
    createdBy: "u1",
    status: "approved",
    visibility: "org",
    tags: ["style", "typescript"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "es_2",
    orgId: "org_1",
    name: "API Rules",
    description: "REST API conventions",
    category: "backend",
    version: "2.0.0",
    content: "# API Rules\n\nUse resource-based URLs.",
    sha256: "def456",
    createdBy: "u2",
    status: "pending",
    visibility: "org",
    tags: ["api", "rest"],
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
];

describe("EnterpriseSkillService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    subscribeToSkills(() => {});
  });

  it("fetches skills from org API", async () => {
    mockOrg();
    mockApi(mockSkills);
    const skills = await fetchSkills();
    expect(skills).toHaveLength(2);
    expect(getCachedSkills()).toHaveLength(2);
  });

  it("creates skill with computed sha256", async () => {
    mockOrg();
    const created = { ...mockSkills[0], id: "es_3", name: "New Skill" };
    mockApi(created);
    const skill = await createSkill({
      name: "New Skill",
      description: "Test",
      category: "fullstack",
      version: "1.0.0",
      content: "test content",
    });
    expect(skill?.name).toBe("New Skill");
  });

  it("updates skill", async () => {
    mockOrg();
    const updated = { ...mockSkills[0], name: "Updated Style Guide" };
    mockApi(updated);
    const skill = await updateSkill("es_1", { name: "Updated Style Guide" });
    expect(skill?.name).toBe("Updated Style Guide");
  });

  it("deletes skill", async () => {
    mockOrg();
    mockApi(undefined, true);
    mockApi(mockSkills);
    await fetchSkills();

    mockApi(undefined, true);
    const deleted = await deleteSkill("es_1");
    expect(deleted).toBe(true);
  });

  it("approves skill", async () => {
    mockOrg();
    mockApi(mockSkills);
    await fetchSkills();

    mockApi(undefined, true);
    const approved = await approveSkill("es_2");
    expect(approved).toBe(true);
  });

  it("filters skills by status", () => {
    const approved = filterSkillsByStatus(mockSkills, "approved");
    expect(approved).toHaveLength(1);
    expect(approved[0]?.id).toBe("es_1");

    const pending = filterSkillsByStatus(mockSkills, "pending");
    expect(pending).toHaveLength(1);
  });

  it("searches skills by name, description, tags", () => {
    const results = searchSkills(mockSkills, "style");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("es_1");

    const apiResults = searchSkills(mockSkills, "REST");
    expect(apiResults).toHaveLength(1);
    expect(apiResults[0]?.id).toBe("es_2");

    const noResults = searchSkills(mockSkills, "nonexistent");
    expect(noResults).toHaveLength(0);
  });

  it("returns null when no org", async () => {
    vi.spyOn(org, "getOrganization").mockReturnValue(null);
    const skill = await createSkill({
      name: "Test",
      description: "Test",
      category: "fullstack",
      version: "1.0.0",
      content: "test",
    });
    expect(skill).toBeNull();
  });
});
