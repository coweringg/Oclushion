import { describe, expect, it, vi, beforeEach } from "vitest";
import * as api from "./enterprise-api.service";
import * as org from "./organization.service";
import {
  fetchHooks,
  createHook,
  updateHook,
  deleteHook,
  toggleHook,
  filterHooksByEvent,
  searchHooks,
  getCachedHooks,
  subscribeToHooks,
} from "./enterprise-hook.service";
import type { EnterpriseHook } from "../types/enterprise-registry";

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

const mockHooks: EnterpriseHook[] = [
  {
    id: "eh_1",
    orgId: "org_1",
    name: "Lint on Save",
    description: "Run linter after saving",
    event: "post-save",
    action: { type: "run-command", command: "pnpm lint", timeout: 30000 },
    enabled: true,
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "eh_2",
    orgId: "org_1",
    name: "Notify on Error",
    description: "Send webhook when error occurs",
    event: "error-occurred",
    action: { type: "send-webhook", url: "https://hooks.acme.com/errors", method: "POST" },
    enabled: false,
    createdBy: "u2",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
];

describe("EnterpriseHookService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    subscribeToHooks(() => {});
  });

  it("fetches hooks from org API", async () => {
    mockOrg();
    mockApi(mockHooks);
    const hooks = await fetchHooks();
    expect(hooks).toHaveLength(2);
    expect(getCachedHooks()).toHaveLength(2);
  });

  it("creates hook", async () => {
    mockOrg();
    const created = { ...mockHooks[0], id: "eh_3", name: "New Hook" };
    mockApi(created);
    const hook = await createHook({
      name: "New Hook",
      description: "Test hook",
      event: "post-save",
      action: { type: "run-command", command: "echo test" },
    });
    expect(hook?.name).toBe("New Hook");
  });

  it("updates hook", async () => {
    mockOrg();
    const updated = { ...mockHooks[0], name: "Updated Lint on Save" };
    mockApi(updated);
    const hook = await updateHook("eh_1", { name: "Updated Lint on Save" });
    expect(hook?.name).toBe("Updated Lint on Save");
  });

  it("deletes hook", async () => {
    mockOrg();
    mockApi(mockHooks);
    await fetchHooks();

    mockApi(undefined, true);
    const deleted = await deleteHook("eh_1");
    expect(deleted).toBe(true);
  });

  it("toggles hook enabled state", async () => {
    mockOrg();
    mockApi(mockHooks);
    await fetchHooks();

    const updated = { ...mockHooks[0], enabled: false };
    mockApi(updated);
    const toggled = await toggleHook("eh_1", false);
    expect(toggled).toBe(true);
  });

  it("filters hooks by event", () => {
    const postSaveHooks = filterHooksByEvent(mockHooks, "post-save");
    expect(postSaveHooks).toHaveLength(1);
    expect(postSaveHooks[0]?.id).toBe("eh_1");

    const errorHooks = filterHooksByEvent(mockHooks, "error-occurred");
    expect(errorHooks).toHaveLength(0); // disabled hooks are filtered out

    const preCommitHooks = filterHooksByEvent(mockHooks, "pre-commit");
    expect(preCommitHooks).toHaveLength(0);
  });

  it("searches hooks by name, description, event", () => {
    const results = searchHooks(mockHooks, "lint");
    expect(results).toHaveLength(1);

    const errorResults = searchHooks(mockHooks, "error");
    expect(errorResults).toHaveLength(1);

    const noResults = searchHooks(mockHooks, "nonexistent");
    expect(noResults).toHaveLength(0);
  });

  it("returns null when no org", async () => {
    vi.spyOn(org, "getOrganization").mockReturnValue(null);
    const hook = await createHook({
      name: "Test",
      description: "Test",
      event: "post-save",
      action: { type: "run-command", command: "echo test" },
    });
    expect(hook).toBeNull();
  });
});
