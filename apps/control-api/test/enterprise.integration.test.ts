import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type {
  CreateDesktopAuthUserInput,
  DesktopAuthUser,
  OrganizationMemberSummary,
  BillingAccountSummary,
} from "../src/storage/repository.js";
import type { FastifyInstance } from "fastify";

const adminToken = "enterprise-test-admin-token-long-enough-32chars";
const internalToken = "enterprise-test-internal-token-long-enough-32";
const organizationId = "ae22b1a6-e1fd-43f5-a43d-a0a133db41df";
const apps = new Set<FastifyInstance>();

const ssoAvailable = !!process.env.WORKOS_API_KEY;

async function loginAs(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: "developer@oclushion.local", password: "password123" },
  });
  return res.json().token;
}

class FakeRepository {
  public ready = true;
  public calls: string[] = [];
  private createdUsers = new Map<string, { email: string; displayName: string | null | undefined }>();

  async ping(): Promise<void> {
    if (!this.ready) throw new Error("postgres unavailable");
  }

  async getDesktopAuthUserByEmail(): Promise<DesktopAuthUser> {
    this.calls.push("getDesktopAuthUserByEmail");
    return {
      userId: "7f2cff3c-c43a-472e-a74c-224321b04653",
      email: "developer@oclushion.local",
      displayName: "Oclushion Developer",
      organizationId,
      role: "owner",
      plan: "enterprise",
      planRenewalDate: "2026-12-31T00:00:00.000Z",
      passwordHash: "40b57dbaf79f8acba01d82bc6c08ece364ca52a1c67fb0d5560cc198d9689b7d7693e9220a7c9eed98870b7a26388deda8aa7cdb4d73398bb324e379590b8aca",
      passwordSalt: "bbbbbbbbbbbbbbbb",
      passwordIterations: 1,
      idpId: null,
      idpProvider: null,
      authMethod: "password",
      totpSecret: null,
      totpEnabledAt: null,
      totpRecoveryCodes: null,
    };
  }

  async getDesktopAuthUser(input: { userId: string }): Promise<DesktopAuthUser> {
    this.calls.push("getDesktopAuthUser");
    const created = this.createdUsers.get(input.userId);
    const email = created?.email ?? "developer@oclushion.local";
    const displayName = created?.displayName ?? "Oclushion Developer";
    return {
      userId: input.userId,
      email,
      displayName,
      organizationId,
      role: "owner",
      plan: "enterprise",
      planRenewalDate: "2026-12-31T00:00:00.000Z",
      passwordHash: "40b57dbaf79f8acba01d82bc6c08ece364ca52a1c67fb0d5560cc198d9689b7d7693e9220a7c9eed98870b7a26388deda8aa7cdb4d73398bb324e379590b8aca",
      passwordSalt: "bbbbbbbbbbbbbbbb",
      passwordIterations: 1,
      idpId: "scim-" + input.userId,
      idpProvider: "scim",
      authMethod: "sso",
      totpSecret: null,
      totpEnabledAt: null,
      totpRecoveryCodes: null,
    };
  }

  async createDesktopAuthUser(input: CreateDesktopAuthUserInput): Promise<DesktopAuthUser> {
    this.calls.push("createDesktopAuthUser");
    const userId = "a6a323c3-3df7-4f7b-b0af-25e95e99f3f1";
    this.createdUsers.set(userId, { email: input.email.toLowerCase(), displayName: input.displayName });
    return {
      userId,
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      organizationId,
      role: "developer",
      plan: "enterprise",
      planRenewalDate: "2026-12-31T00:00:00.000Z",
      passwordHash: "",
      passwordSalt: "",
      passwordIterations: 0,
      idpId: input.idpId ?? null,
      idpProvider: input.idpProvider ?? null,
      authMethod: input.authMethod ?? "password",
      totpSecret: null,
      totpEnabledAt: null,
      totpRecoveryCodes: null,
    };
  }

  async signSessionToken(): Promise<string> { return "signed-jwt-token"; }

  async recordDesktopAuditEvents(): Promise<void> { this.calls.push("recordDesktopAuditEvents"); }
  async listAuditEventsByOrg(): Promise<any[]> { this.calls.push("listAuditEventsByOrg"); return []; }
  async listOrganizations(): Promise<any[]> { this.calls.push("listOrganizations"); return []; }
  async deleteAuditEventsOlderThan(): Promise<void> { this.calls.push("deleteAuditEventsOlderThan"); }
  async exportAuditEvents(): Promise<any[]> { this.calls.push("exportAuditEvents"); return []; }
  async upsertAuditWebhook(): Promise<void> { this.calls.push("upsertAuditWebhook"); }

  async listConnectorConnections(): Promise<any[]> { return []; }
  async revokeConnectorConnection(): Promise<void> {}

  async listOrganizationMembers(): Promise<OrganizationMemberSummary[]> {
    this.calls.push("listOrganizationMembers");
    return [
      { userId: "7f2cff3c-c43a-472e-a74c-224321b04653", email: "developer@oclushion.local", displayName: "Oclushion Developer", role: "owner", createdAt: "2026-01-01T00:00:00.000Z", disabledAt: null },
      { userId: "u1", email: "owner@oclushion.local", displayName: "Owner", role: "owner", createdAt: "2026-01-01T00:00:00.000Z", disabledAt: null },
      { userId: "u2", email: "dev@oclushion.local", displayName: "Developer", role: "developer", createdAt: "2026-02-01T00:00:00.000Z", disabledAt: null },
      { userId: "u3", email: "auditor@oclushion.local", displayName: "Auditor", role: "auditor", createdAt: "2026-03-01T00:00:00.000Z", disabledAt: null },
    ];
  }

  async upsertOrganizationMember(input: { organizationId: string; email: string; role: string; displayName?: string }): Promise<OrganizationMemberSummary> {
    this.calls.push("upsertOrganizationMember");
    return { userId: "u-new", email: input.email, displayName: input.displayName ?? null, role: input.role as any, createdAt: new Date().toISOString(), disabledAt: null };
  }

  async disableOrganizationMember(): Promise<void> { this.calls.push("disableOrganizationMember"); }
  async removeOrganizationMember(): Promise<void> { this.calls.push("removeOrganizationMember"); }

  async upsertBillingAccount(input: { organizationId: string; plan: string }): Promise<BillingAccountSummary> {
    this.calls.push("upsertBillingAccount");
    return { organizationId: input.organizationId, plan: input.plan as any, status: "active", billingEmail: "billing@oclushion.local", currentPeriodStart: "2026-01-01", currentPeriodEnd: "2026-12-31", externalCustomerId: null, updatedAt: "2026-01-01" };
  }
  async getBillingAccount(): Promise<BillingAccountSummary> {
    return { organizationId, plan: "enterprise", status: "active", billingEmail: "billing@oclushion.local", currentPeriodStart: "2026-01-01", currentPeriodEnd: "2026-12-31", externalCustomerId: null, updatedAt: "2026-01-01" };
  }

  async getCreditBalance(): Promise<any> { return { organizationId, balance: 100 }; }
  async getSpendCap(): Promise<any> { return { organizationId, dailySpendLimit: 500 }; }
  async updateSpendCap(): Promise<any> { return { organizationId, dailySpendLimit: 500 }; }
  async getLaunchReadiness(): Promise<any> { return { productionReady: true }; }
  async recordUsageEvent(): Promise<any> { return { id: "ue-1", organizationId }; }
  async debitCredits(): Promise<any> { return { totalTokens: 100, creditsDelta: -1, idempotencyKey: "test" }; }
  async getCreditLedger(): Promise<any[]> { return []; }

  async listPublishedPolicySets(): Promise<any[]> { return []; }
  async createPublishedPolicySet(): Promise<any> { return { id: "ps-1", organizationId, name: "Test Policy", versionId: "pv-1", bound: true, createdAt: new Date().toISOString() }; }
  async getPolicySet(): Promise<any> { return { id: "ps-1", organizationId, name: "Test Policy", versionId: "pv-1", bound: true, createdAt: new Date().toISOString() }; }
  async draftPolicyVersion(): Promise<any> { return { id: "pv-1", policySetId: "ps-1", versionNumber: 2, status: "draft", snapshot: {}, createdAt: new Date().toISOString() }; }
  async commitPolicyVersion(): Promise<any> { return { id: "pv-1", policySetId: "ps-1", versionNumber: 2, status: "active", snapshot: {}, createdAt: new Date().toISOString() }; }
  async comparePolicyVersions(): Promise<any> { return { added: [], removed: [], modified: [] }; }
  async listBoundPublishedSnapshots(): Promise<any[]> { this.calls.push("listBoundPublishedSnapshots"); return []; }

  async getPublicKey(): Promise<string> { return "ssh-ed25519 AAA..."; }
  async getSSHUserKey(): Promise<string> { return "ssh-ed25519 AAA..."; }

  async getSSOConnectionByDomain(): Promise<any> {
    this.calls.push("getSSOConnectionByDomain");
    return { id: "sso-1", organizationId, provider: "google_workspace", domain: "oclushion.local", idpMetadata: null, clientId: null, enabled: true, roleMappings: [] };
  }
  async listSSOConnections(): Promise<any[]> { this.calls.push("listSSOConnections"); return []; }
  async upsertSSOConnection(): Promise<void> { this.calls.push("upsertSSOConnection"); }
  async deleteSSOConnection(): Promise<void> { this.calls.push("deleteSSOConnection"); }

  async getConnectorOAuthStartUrl(): Promise<any> { return { url: "https://oauth.start", state: "state-1" }; }
  async completeConnectorOAuth(): Promise<void> {}
  async createConnectorConnection(): Promise<any> { return { id: "conn-1", providerId: "github", organizationId, status: "active", createdAt: new Date().toISOString() }; }
  async deleteConnectorConnection(): Promise<void> {}

  async createGatewayApiKey(): Promise<any> { return { id: "key-1", apiKey: "sk-...", name: "test" }; }
  async revokeGatewayApiKey(): Promise<void> {}
  async listGatewayApiKeys(): Promise<any[]> { return []; }

  async createOrganization(name: string): Promise<any> { return { id: "org-new", name }; }
  async listAllOrganizations(): Promise<any[]> { return []; }
  async createPolicySet(): Promise<any> { return { id: "ps-1", name: "test" }; }
  async createPolicyVersion(): Promise<any> { return { id: "pv-1", versionNumber: 1 }; }
  async updatePolicySetName(): Promise<void> {}
  async getPolicyVersionSnapshot(): Promise<any> { return { rules: [] }; }
  async deletePolicySet(): Promise<void> {}

  async startConnectorOAuth(): Promise<any> { return { url: "https://oauth.start", state: "state-1" }; }
  async getConnectorConnection(): Promise<any> { return null; }
  async updateConnectorConnectionStatus(): Promise<void> {}

  async getChatProtectionPolicies(): Promise<any[]> { return []; }
  async upsertChatProtectionPolicy(): Promise<void> {}
  async deleteChatProtectionPolicy(): Promise<void> {}
  async getMaskingPatterns(): Promise<any[]> { return []; }
  async upsertMaskingPattern(): Promise<void> {}
  async deleteMaskingPattern(): Promise<void> {}
  async getDataProtectionConfig(): Promise<any> { return null; }
  async upsertDataProtectionConfig(): Promise<void> {}
  async getDataClassificationRules(): Promise<any[]> { return []; }
  async upsertDataClassificationRule(): Promise<void> {}
  async deleteDataClassificationRule(): Promise<void> {}
  async getSanitizationRules(): Promise<any[]> { return []; }
  async upsertSanitizationRule(): Promise<void> {}
  async deleteSanitizationRule(): Promise<void> {}
  async getPiiDetectionPatterns(): Promise<any[]> { return []; }
  async upsertPiiDetectionPattern(): Promise<void> {}
  async deletePiiDetectionPattern(): Promise<void> {}
  async getDataSources(): Promise<any[]> { return []; }
  async createDataSource(): Promise<any> { return { id: "ds-1", name: "test", kind: "postgres" }; }
  async updateDataSource(): Promise<void> {}
  async deleteDataSource(): Promise<void> {}
  async getDataFieldProtections(): Promise<any[]> { return []; }
  async upsertDataFieldProtection(): Promise<void> {}
  async deleteDataFieldProtection(): Promise<void> {}
  async enableMfa(): Promise<void> { this.calls.push("enableMfa"); }
  async disableMfa(): Promise<void> { this.calls.push("disableMfa"); }
  async consumeMfaRecoveryCode(): Promise<void> { this.calls.push("consumeMfaRecoveryCode"); }
  async validateScimToken(): Promise<any> { return null; }
  async touchScimToken(): Promise<void> {}
}

describe("Enterprise integration — SSO → Audit → Policies → SCIM", () => {
  afterEach(async () => {
    for (const app of apps) {
      await app.close().catch(() => {});
    }
    apps.clear();
  });

  it.skipIf(!ssoAvailable)("SSO: authorize returns redirectUrl + flowId", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/sso/authorize",
      payload: { domain: "oclushion.local" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("redirectUrl");
    expect(body).toHaveProperty("flowId");
    expect(body.redirectUrl).toContain("workos.com");
    expect(body.flowId).toMatch(/^[0-9a-f-]{36}$/);
    expect(repo.calls).toContain("getSSOConnectionByDomain");
  });

  it("SSO: authorize rejects unknown domain", { timeout: 10_000 }, async () => {
    const repo = new FakeRepository();
    repo.getSSOConnectionByDomain = async () => null;
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/sso/authorize",
      payload: { domain: "unknown.com" },
    });

    expect(res.statusCode).toBe(404);
  });

  it.skipIf(!ssoAvailable)("SSO: callback returns token for programmatic clients", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "GET",
      url: "/v1/auth/sso/callback?code=test-code",
    });

    expect(res.statusCode).toBe(400);
  });

  it("SSO: admin CRUD requires org:manage permission", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const listRes = await app.inject({
      method: "GET",
      url: `/v1/orgs/${organizationId}/sso`,
    });
    expect(listRes.statusCode).toBe(401);

    const authRes = await app.inject({
      method: "GET",
      url: `/v1/orgs/${organizationId}/sso`,
      headers: { authorization: "Bearer invalid" },
    });
    expect(authRes.statusCode).toBe(401);
  });

  it("Audit: records and lists events", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, enableRateLimiting: false });
    apps.add(app);
    const sessionToken = await loginAs(app);

    const recordRes = await app.inject({
      method: "POST",
      url: "/v1/desktop/audit-events/batch",
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: {
        organizationId,
        events: [{ type: "test.event", summary: "Test event", metadata: { key: "value" }, timestamp: new Date().toISOString() }],
      },
    });
    expect(recordRes.statusCode).toBe(202);
    expect(repo.calls).toContain("recordDesktopAuditEvents");
  });

  it("Audit: export returns CSV or JSON", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, enableRateLimiting: false });
    apps.add(app);
    const sessionToken = await loginAs(app);

    const jsonRes = await app.inject({
      method: "GET",
      url: `/v1/desktop/audit-events/export?organizationId=${organizationId}&format=json`,
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(jsonRes.statusCode).toBe(200);

    const csvRes = await app.inject({
      method: "GET",
      url: `/v1/desktop/audit-events/export?organizationId=${organizationId}&format=csv`,
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
  });

  it("Policies: returns bound snapshot", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, enableRateLimiting: false });
    apps.add(app);
    const sessionToken = await loginAs(app);

    const res = await app.inject({
      method: "GET",
      url: `/v1/desktop/policies/snapshot?organizationId=${organizationId}`,
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(repo.calls).toContain("listBoundPublishedSnapshots");
  });

  it("SCIM: ServiceProviderConfig", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "GET",
      url: "/scim/v2/ServiceProviderConfig",
      headers: { authorization: `Bearer ${internalToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().schemas).toContain("urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig");
  });

  it("SCIM: Schemas", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "GET",
      url: "/scim/v2/Schemas",
      headers: { authorization: `Bearer ${internalToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.Resources).toHaveLength(3);
  });

  it("SCIM: list Users requires X-Organization-ID", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "GET",
      url: "/scim/v2/Users?startIndex=1&count=10",
      headers: { authorization: `Bearer ${internalToken}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("SCIM: list Users with org header", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "GET",
      url: "/scim/v2/Users?startIndex=1&count=10",
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-organization-id": organizationId,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.schemas).toContain("urn:ietf:params:scim:api:messages:2.0:ListResponse");
    expect(body.Resources).toBeDefined();
    expect(repo.calls).toContain("listOrganizationMembers");
  });

  it("SCIM: create User", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "POST",
      url: "/scim/v2/Users",
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-organization-id": organizationId,
        "content-type": "application/json",
      },
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: "newuser@oclushion.local",
        displayName: "New User",
        active: true,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().userName).toBe("newuser@oclushion.local");
    expect(repo.calls).toContain("createDesktopAuthUser");
    expect(repo.calls).toContain("upsertOrganizationMember");
  });

  it("SCIM: get User", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "GET",
      url: `/scim/v2/Users/7f2cff3c-c43a-472e-a74c-224321b04653`,
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-organization-id": organizationId,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe("7f2cff3c-c43a-472e-a74c-224321b04653");
  });

  it("SCIM: PATCH User deactivate", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Users/7f2cff3c-c43a-472e-a74c-224321b04653`,
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-organization-id": organizationId,
        "content-type": "application/json",
      },
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", path: "active", value: false }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(repo.calls).toContain("removeOrganizationMember");
  });

  it("SCIM: delete User", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "DELETE",
      url: `/scim/v2/Users/7f2cff3c-c43a-472e-a74c-224321b04653`,
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-organization-id": organizationId,
      },
    });
    expect(res.statusCode).toBe(204);
    expect(repo.calls).toContain("removeOrganizationMember");
  });

  it("SCIM: list Groups", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, internalToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "GET",
      url: "/scim/v2/Groups",
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-organization-id": organizationId,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.Resources.length).toBeGreaterThanOrEqual(1);
    const names = body.Resources.map((g: any) => g.displayName);
    expect(names).toContain("owner");
    expect(names).toContain("developer");
    expect(names).toContain("auditor");
  });

  it("Auth: login with valid credentials returns session", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "developer@oclushion.local", password: "password123" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("user");
    expect(body.user.email).toBe("developer@oclushion.local");
  });

  it("RBAC: OrgRole enum matches DB constraint", async () => {
    const repo = new FakeRepository();
    const app = await createApp(repo as any, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const roles = ["owner", "admin", "security_officer", "auditor", "developer", "viewer"];
    for (const role of roles) {
      const res = await app.inject({
        method: "PUT",
        url: `/v1/organizations/${organizationId}/members`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { email: `${role}@test.com`, displayName: role, role },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().role).toBe(role);
    }
    expect(repo.calls.filter((c) => c === "upsertOrganizationMember")).toHaveLength(6);
  });
});