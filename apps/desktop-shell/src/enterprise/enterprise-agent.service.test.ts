import { describe, expect, it, vi, beforeEach } from "vitest";
import * as api from "./enterprise-api.service";
import * as org from "./organization.service";
import {
  fetchAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  filterAgentsByStatus,
  searchAgents,
  getCachedAgents,
  subscribeToAgents,
} from "./enterprise-agent.service";
import type { EnterpriseAgent } from "../types/enterprise-registry";

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
      allowedCategories: ["fullstack"],
      maxSkillsPerOrg: 500,
    },
  });
}

const mockAgents: EnterpriseAgent[] = [
  {
    id: "ea_1",
    orgId: "org_1",
    name: "Code Reviewer",
    description: "Reviews code for Acme standards",
    role: "code-reviewer",
    systemPrompt: "You are a code reviewer for Acme Corp.",
    skillIds: ["es_1"],
    mcpIds: [],
    status: "approved",
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "ea_2",
    orgId: "org_1",
    name: "Security Scanner",
    description: "Scans for security issues",
    role: "security-scanner",
    systemPrompt: "You are a security auditor.",
    skillIds: ["es_2"],
    mcpIds: ["github"],
    status: "draft",
    createdBy: "u2",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
];

describe("EnterpriseAgentService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    subscribeToAgents(() => {});
  });

  it("fetches agents from org API", async () => {
    mockOrg();
    mockApi(mockAgents);
    const agents = await fetchAgents();
    expect(agents).toHaveLength(2);
    expect(getCachedAgents()).toHaveLength(2);
  });

  it("creates agent", async () => {
    mockOrg();
    const created = { ...mockAgents[0], id: "ea_3", name: "New Agent" };
    mockApi(created);
    const agent = await createAgent({
      name: "New Agent",
      description: "Test agent",
      role: "tester",
      systemPrompt: "You are a tester.",
    });
    expect(agent?.name).toBe("New Agent");
  });

  it("updates agent", async () => {
    mockOrg();
    const updated = { ...mockAgents[0], name: "Senior Code Reviewer" };
    mockApi(updated);
    const agent = await updateAgent("ea_1", { name: "Senior Code Reviewer" });
    expect(agent?.name).toBe("Senior Code Reviewer");
  });

  it("deletes agent", async () => {
    mockOrg();
    mockApi(mockAgents);
    await fetchAgents();

    mockApi(undefined, true);
    const deleted = await deleteAgent("ea_1");
    expect(deleted).toBe(true);
  });

  it("filters agents by status", () => {
    const approved = filterAgentsByStatus(mockAgents, "approved");
    expect(approved).toHaveLength(1);
    expect(approved[0]?.id).toBe("ea_1");

    const draft = filterAgentsByStatus(mockAgents, "draft");
    expect(draft).toHaveLength(1);
  });

  it("searches agents by name, description, role", () => {
    const results = searchAgents(mockAgents, "reviewer");
    expect(results).toHaveLength(1);

    const securityResults = searchAgents(mockAgents, "security");
    expect(securityResults).toHaveLength(1);

    const noResults = searchAgents(mockAgents, "nonexistent");
    expect(noResults).toHaveLength(0);
  });

  it("returns null when no org", async () => {
    vi.spyOn(org, "getOrganization").mockReturnValue(null);
    const agent = await createAgent({
      name: "Test",
      description: "Test",
      role: "test",
      systemPrompt: "test",
    });
    expect(agent).toBeNull();
  });
});
