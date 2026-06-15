import { describe, expect, it, vi, beforeEach } from "vitest";
import * as api from "./enterprise-api.service";
import {
  getOrganization,
  setOrganization,
  fetchOrganization,
  createOrganization,
  updateOrganization,
  fetchMembers,
  inviteMember,
  removeMember,
  updateMemberRole,
  canManageOrg,
  canUploadSkills,
  canApproveSkills,
  subscribeToOrg,
} from "./organization.service";
import type { Organization, OrgMember } from "../types/enterprise-registry";

vi.mock("./enterprise-api.service", () => ({
  enterpriseApi: vi.fn(),
}));

function mockApi<T>(data: T, ok = true, status = 200) {
  return vi.spyOn(api, "enterpriseApi").mockResolvedValue({ ok, status, data });
}

const mockOrg: Organization = {
  id: "org_1",
  name: "Acme Corp",
  slug: "acme-corp",
  plan: "enterprise",
  createdAt: "2026-01-01T00:00:00.000Z",
  settings: {
    allowMemberUploads: true,
    requireAdminApproval: true,
    allowedCategories: ["fullstack", "frontend", "backend"],
    maxSkillsPerOrg: 500,
  },
};

const mockMembers: OrgMember[] = [
  { userId: "u1", email: "admin@acme.com", name: "Admin", role: "owner", joinedAt: "2026-01-01T00:00:00.000Z" },
  { userId: "u2", email: "dev@acme.com", name: "Dev", role: "developer", joinedAt: "2026-02-01T00:00:00.000Z" },
];

describe("OrganizationService", () => {
  beforeEach(() => {
    setOrganization(null);
    vi.restoreAllMocks();
  });

  it("fetches organization by ID", async () => {
    mockApi(mockOrg);
    const org = await fetchOrganization("org_1");
    expect(org).toEqual(mockOrg);
    expect(getOrganization()?.id).toBe("org_1");
  });

  it("creates organization", async () => {
    mockApi(mockOrg);
    const org = await createOrganization({ name: "Acme Corp", plan: "enterprise" });
    expect(org?.name).toBe("Acme Corp");
  });

  it("updates organization settings", async () => {
    const updated = { ...mockOrg, settings: { ...mockOrg.settings, maxSkillsPerOrg: 1000 } };
    mockApi(updated);
    const org = await updateOrganization("org_1", { settings: { maxSkillsPerOrg: 1000 } });
    expect(org?.settings.maxSkillsPerOrg).toBe(1000);
  });

  it("fetches members", async () => {
    mockApi(mockMembers);
    const members = await fetchMembers("org_1");
    expect(members).toHaveLength(2);
  });

  it("invites member", async () => {
    const newMember: OrgMember = { userId: "u3", email: "new@acme.com", name: "New", role: "viewer", joinedAt: "2026-03-01T00:00:00.000Z" };
    mockApi(newMember);
    const member = await inviteMember("org_1", { email: "new@acme.com", role: "viewer" });
    expect(member?.userId).toBe("u3");
  });

  it("removes member", async () => {
    mockApi(undefined, true, 204);
    const removed = await removeMember("org_1", "u2");
    expect(removed).toBe(true);
  });

  it("updates member role", async () => {
    mockApi(undefined, true, 200);
    const updated = await updateMemberRole("org_1", "u2", "admin");
    expect(updated).toBe(true);
  });

  it("role checks are correct", () => {
    expect(canManageOrg("owner")).toBe(true);
    expect(canManageOrg("admin")).toBe(true);
    expect(canManageOrg("security_officer")).toBe(false);
    expect(canManageOrg("auditor")).toBe(false);
    expect(canManageOrg("developer")).toBe(false);
    expect(canManageOrg("viewer")).toBe(false);

    expect(canUploadSkills("owner")).toBe(true);
    expect(canUploadSkills("admin")).toBe(true);
    expect(canUploadSkills("developer")).toBe(true);
    expect(canUploadSkills("security_officer")).toBe(false);
    expect(canUploadSkills("auditor")).toBe(false);
    expect(canUploadSkills("viewer")).toBe(false);

    expect(canApproveSkills("owner")).toBe(true);
    expect(canApproveSkills("admin")).toBe(true);
    expect(canApproveSkills("developer")).toBe(false);
    expect(canApproveSkills("security_officer")).toBe(false);
  });

  it("subscribes to org changes", async () => {
    const listener = vi.fn();
    const unsub = subscribeToOrg(listener);
    expect(listener).toHaveBeenCalledWith(null);

    setOrganization(mockOrg);
    expect(listener).toHaveBeenCalledWith(mockOrg);

    unsub();
    setOrganization(null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
