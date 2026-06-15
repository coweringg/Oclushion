import { afterEach, describe, expect, it } from "vitest";

import type { PolicySnapshot } from "@oclushion/shared";

import { createApp } from "../src/app.js";
import type {
  ControlRepository,
  ConnectorConnectionSummary,
  CreateDesktopAuthUserInput,
  ConnectorOAuthStartResult,
  CreditBalanceSummary,
  CreditLedgerEntry,
  CreatedGatewayApiKey,
  CreatedOrganization,
  CreatedPolicySet,
  DesktopAuthUser,
  DraftPolicyVersion,
  BillingAccountSummary,
  LaunchReadiness,
  OrganizationMemberSummary,
  SpendCapSummary,
  UsageMeterEvent,
  UsageSummary,
} from "../src/storage/repository.js";
import { RepositoryConflictError } from "../src/storage/repository.js";
import { calculateCreditsForTokens } from "../src/billing/credits.js";

import type { FastifyInstance } from "fastify";

const adminToken = "phase1-local-admin-token-that-is-long-enough";
const organizationId = "ae22b1a6-e1fd-43f5-a43d-a0a133db41df";
const policyId = "889d25cf-40f6-4ac3-b3ec-57ca1c079f4d";
const policyVersionId = "d85e436a-7b39-43ce-b2e8-bc1ac44d1e79";
const connectorConnectionId = "11111111-2222-4333-8444-555555555555";
const apps = new Set<FastifyInstance>();

class FakeRepository implements ControlRepository {
  public ready = true;
  public calls: string[] = [];
  public duplicateDesktopRegistration = false;

  async ping(): Promise<void> {
    if (!this.ready) {
      throw new Error("postgres unavailable");
    }
  }

  async getDesktopAuthUserByEmail(): Promise<DesktopAuthUser> {
    this.calls.push("getDesktopAuthUserByEmail");
    return {
      userId: "7f2cff3c-c43a-472e-a74c-224321b04653",
      email: "developer@oclushion.local",
      displayName: "Oclushion Developer",
      organizationId,
      role: "owner",
      plan: "pro",
      planRenewalDate: "2026-06-18T00:00:00.000Z",
      passwordHash:
        "4fa75e4bddbda3fe45ca086f4de073e9f2e3ccabf167f54126a617d5be47914d179d3527151188e31f666a7a459340a24590038bc1628776d6e88f34110385b2",
      passwordSalt: "f27a0d62e4ab97824850296d9b8ce77d",
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
    return {
      userId: input.userId ?? "7f2cff3c-c43a-472e-a74c-224321b04653",
      email: "developer@oclushion.local",
      displayName: "Oclushion Developer",
      organizationId,
      role: "owner",
      plan: "pro",
      planRenewalDate: "2026-06-18T00:00:00.000Z",
      passwordHash:
        "4fa75e4bddbda3fe45ca086f4de073e9f2e3ccabf167f54126a617d5be47914d179d3527151188e31f666a7a459340a24590038bc1628776d6e88f34110385b2",
      passwordSalt: "f27a0d62e4ab97824850296d9b8ce77d",
      passwordIterations: 1,
      idpId: null,
      idpProvider: null,
      authMethod: "password",
      totpSecret: null,
      totpEnabledAt: null,
      totpRecoveryCodes: null,
    };
  }

  async createDesktopAuthUser(input: CreateDesktopAuthUserInput): Promise<DesktopAuthUser> {
    this.calls.push("createDesktopAuthUser");
    if (this.duplicateDesktopRegistration) {
      throw new RepositoryConflictError("An Oclushion account already exists for this email.");
    }
    return {
      userId: "a6a323c3-3df7-4f7b-b0af-25e95e99f3f1",
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      organizationId,
      role: "owner",
      plan: "free",
      planRenewalDate: "2026-07-01T00:00:00.000Z",
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
      passwordIterations: input.passwordIterations,
      idpId: input.idpId ?? null,
      idpProvider: input.idpProvider ?? null,
      authMethod: input.authMethod ?? "password",
      totpSecret: null,
      totpEnabledAt: null,
      totpRecoveryCodes: null,
    };
  }

  async recordDesktopAuditEvents(): Promise<void> {
    this.calls.push("recordDesktopAuditEvents");
  }

  async listOrganizations(): Promise<Array<{
    id: string;
    slug: string;
    name: string;
    plan: string;
    auditRetentionDays: number;
  }>> {
    this.calls.push("listOrganizations");
    return [{
      id: organizationId,
      slug: "oclushion-test",
      name: "Oclushion Test",
      plan: "pro",
      auditRetentionDays: 30,
    }];
  }

  async deleteAuditEventsOlderThan(): Promise<void> {
    this.calls.push("deleteAuditEventsOlderThan");
  }

  async exportAuditEvents(): Promise<Array<{
    id: string;
    eventType: string;
    status: string;
    decision: string | null;
    actorId: string | null;
    occurredAt: string;
    summary: string;
    metadata: Record<string, unknown>;
  }>> {
    this.calls.push("exportAuditEvents");
    return [];
  }

  async upsertAuditWebhook(): Promise<void> {
    this.calls.push("upsertAuditWebhook");
  }

  async getSSOConnectionByDomain(): Promise<null> {
    this.calls.push("getSSOConnectionByDomain");
    return null;
  }

  async listSSOConnections(): Promise<[]> {
    this.calls.push("listSSOConnections");
    return [];
  }

  async upsertSSOConnection(): Promise<void> {
    this.calls.push("upsertSSOConnection");
  }

  async deleteSSOConnection(): Promise<void> {
    this.calls.push("deleteSSOConnection");
  }

  async createOrganization(): Promise<CreatedOrganization> {
    this.calls.push("createOrganization");
    return {
      id: organizationId,
      name: "Oclushion Test",
      slug: "oclushion-test",
      createdAt: "2026-05-27T12:00:00.000Z",
    };
  }

  async ensureOrganization(): Promise<CreatedOrganization> {
    this.calls.push("ensureOrganization");
    return {
      id: organizationId,
      name: "Oclushion Test",
      slug: "oclushion-test",
      createdAt: "2026-05-27T12:00:00.000Z",
    };
  }

  async createPolicySet(): Promise<CreatedPolicySet> {
    this.calls.push("createPolicySet");
    return {
      id: policyId,
      organizationId,
      name: "Gateway protection",
      module: "gateway-protect",
      createdAt: "2026-05-27T12:00:00.000Z",
    };
  }

  async createPolicyVersion(): Promise<DraftPolicyVersion> {
    this.calls.push("createPolicyVersion");
    return {
      id: policyVersionId,
      policyId,
      organizationId,
      version: 1,
      rules: [{ id: "email", effect: "TOKENIZE", priority: 100, enabled: true, actions: [], entityTypes: ["email"], conditions: [] }],
      status: "draft",
      createdAt: "2026-05-27T12:00:00.000Z",
    };
  }

  async publishPolicyVersion(): Promise<PolicySnapshot> {
    this.calls.push("publishPolicyVersion");
    return this.snapshot();
  }

  async getPublishedSnapshot(): Promise<PolicySnapshot> {
    this.calls.push("getPublishedSnapshot");
    return this.snapshot();
  }

  async createGatewayApiKey(): Promise<CreatedGatewayApiKey> {
    this.calls.push("createGatewayApiKey");
    return {
      id: "e74c10c2-3b54-405e-a806-59979d16b526",
      organizationId,
      name: "Gateway key",
      keyPrefix: "oclushion_live_test_key",
      apiKey: "oclushion_live_test_secret_that_is_shown_once",
      scopes: ["proxy:invoke"],
      createdAt: "2026-05-27T12:00:00.000Z",
      expiresAt: "2026-08-25T12:00:00.000Z",
    };
  }

  async listGatewayApiKeys() {
    this.calls.push("listGatewayApiKeys");
    return [
      {
        id: "e74c10c2-3b54-405e-a806-59979d16b526",
        organizationId,
        name: "Gateway key",
        keyPrefix: "oclushion_live_test_key",
        scopes: ["proxy:invoke"],
        createdAt: "2026-05-27T12:00:00.000Z",
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: "2026-08-25T12:00:00.000Z",
        lastRotatedAt: null,
        rotationCount: 0,
      },
    ];
  }

  async revokeGatewayApiKey(): Promise<void> {
    this.calls.push("revokeGatewayApiKey");
  }

  async rotateGatewayApiKey(): Promise<CreatedGatewayApiKey> {
    this.calls.push("rotateGatewayApiKey");
    return {
      id: "f84c20d3-4b63-4a7f-b917-6a9802c1e728",
      organizationId,
      name: "Gateway key",
      keyPrefix: "oclushion_live_rotated",
      apiKey: "oclushion_live_rotated_secret",
      scopes: ["proxy:invoke"],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async listExpiringApiKeys(): Promise<Array<{ id: string; organizationId: string; name: string; keyPrefix: string; expiresAt: string }>> {
    this.calls.push("listExpiringApiKeys");
    return [];
  }

  async bindModulePolicy(): Promise<void> {
    this.calls.push("bindModulePolicy");
  }

  async upsertModulePolicy(): Promise<PolicySnapshot> {
    this.calls.push("upsertModulePolicy");
    return this.snapshot();
  }

  async getBoundPublishedSnapshot(): Promise<PolicySnapshot> {
    this.calls.push("getBoundPublishedSnapshot");
    return this.snapshot();
  }

  async listBoundPublishedSnapshots(): Promise<PolicySnapshot[]> {
    this.calls.push("listBoundPublishedSnapshots");
    return [this.snapshot()];
  }

  async getDashboardOverview() {
    this.calls.push("getDashboardOverview");
    return {
      requestCount: 1,
      tokenCount: 2,
      averageLatencyMs: 12,
      p95LatencyMs: 20,
      activeProviders: 1,
      pendingEvents: 0,
      modules: [{ module: "gateway-protect", events: 1, lastEventAt: "2026-05-27T12:00:00.000Z", status: "active" as const }],
      timeseries: [{ label: "2026-05-27T12:00:00.000Z", requests: 1, latencyMs: 12 }],
      entities: [{ type: "email", count: 2 }],
    };
  }

  async listAuditEvents() {
    this.calls.push("listAuditEvents");
    return {
      events: [],
      page: 1,
      totalPages: 1,
      total: 0,
    };
  }

  async recordBrowserAuditEvent(): Promise<void> {
    this.calls.push("recordBrowserAuditEvent");
  }

  async startConnectorOAuth(): Promise<ConnectorOAuthStartResult> {
    this.calls.push("startConnectorOAuth");
    return {
      provider: "google-drive",
      authorizationUrl:
        "https://accounts.google.com/o/oauth2/v2/auth?code_challenge=challenge",
      state: "oauth-state-long-enough",
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      expiresAt: "2026-05-27T12:10:00.000Z",
    };
  }

  async completeConnectorOAuth(): Promise<ConnectorConnectionSummary> {
    this.calls.push("completeConnectorOAuth");
    return this.connectorConnection("active");
  }

  async listConnectorConnections(): Promise<ConnectorConnectionSummary[]> {
    this.calls.push("listConnectorConnections");
    return [this.connectorConnection("active")];
  }

  async revokeConnectorConnection(): Promise<void> {
    this.calls.push("revokeConnectorConnection");
  }

  async listOrganizationMembers(): Promise<OrganizationMemberSummary[]> {
    this.calls.push("listOrganizationMembers");
    return [this.member("owner")];
  }

  async upsertOrganizationMember(): Promise<OrganizationMemberSummary> {
    this.calls.push("upsertOrganizationMember");
    return this.member("security_officer");
  }

  async disableOrganizationMember(): Promise<void> {
    this.calls.push("disableOrganizationMember");
  }

  async removeOrganizationMember(): Promise<void> {
    this.calls.push("removeOrganizationMember");
  }

  async upsertBillingAccount(): Promise<BillingAccountSummary> {
    this.calls.push("upsertBillingAccount");
    return this.billing();
  }

  async getBillingAccount(): Promise<BillingAccountSummary> {
    this.calls.push("getBillingAccount");
    return this.billing();
  }

  async recordUsageEvent(): Promise<UsageMeterEvent> {
    this.calls.push("recordUsageEvent");
    return {
      id: "b02cb61e-f576-4d0b-bcc1-86b69e5fd37c",
      organizationId,
      module: "gateway-protect",
      eventName: "request.sanitized",
      quantity: 3,
      occurredAt: "2026-05-27T12:00:00.000Z",
    };
  }

  async getUsageSummary(): Promise<UsageSummary> {
    this.calls.push("getUsageSummary");
    return {
      organizationId,
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-06-01T00:00:00.000Z",
      totalQuantity: 3,
      byModule: [{ module: "gateway-protect", quantity: 3 }],
    };
  }

  async debitCredits(): Promise<CreditLedgerEntry> {
    this.calls.push("debitCredits");
    return {
      id: "4200e8ff-711f-4f35-9bc2-6371249c7d07",
      organizationId,
      userId: "7f2cff3c-c43a-472e-a74c-224321b04653",
      type: "debit",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1200,
      outputTokens: 800,
      totalTokens: 2000,
      creditsDelta: -12,
      balanceAfter: -12,
      idempotencyKey: "credit-debit-1",
      occurredAt: "2026-05-27T12:00:00.000Z",
    };
  }

  async grantCredits(): Promise<CreditLedgerEntry> {
    this.calls.push("grantCredits");
    return {
      id: "4200e8ff-711f-4f35-9bc2-6371249c7d08",
      organizationId,
      userId: "7f2cff3c-c43a-472e-a74c-224321b04653",
      type: "grant",
      provider: "stripe",
      model: "oclushion-credit-pack",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      creditsDelta: 20_000,
      balanceAfter: 20_000,
      idempotencyKey: "stripe:checkout",
      occurredAt: "2026-05-27T12:00:00.000Z",
    };
  }

  async getCreditBalance(): Promise<CreditBalanceSummary> {
    this.calls.push("getCreditBalance");
    return {
      organizationId,
      balance: -2,
    };
  }

  async getSpendCap(): Promise<SpendCapSummary> {
    this.calls.push("getSpendCap");
    return {
      organizationId,
      dailySpendLimit: 5000,
      currentDailySpend: 12,
      dailySpendDate: "2026-06-03",
    };
  }

  async updateSpendCap(): Promise<SpendCapSummary> {
    this.calls.push("updateSpendCap");
    return {
      organizationId,
      dailySpendLimit: 7000,
      currentDailySpend: 0,
      dailySpendDate: "2026-06-03",
    };
  }

  async getLaunchReadiness(): Promise<LaunchReadiness> {
    this.calls.push("getLaunchReadiness");
    return {
      organizationId,
      productionReady: true,
      checks: [{ id: "identity-owner", label: "Owner", passed: true, detail: "1 owner" }],
    };
  }

  async enableMfa(): Promise<void> {
    this.calls.push("enableMfa");
  }

  async disableMfa(): Promise<void> {
    this.calls.push("disableMfa");
  }

  async consumeMfaRecoveryCode(): Promise<void> {
    this.calls.push("consumeMfaRecoveryCode");
  }

  private snapshot(): PolicySnapshot {
    return {
      organizationId,
      policyId,
      policyVersionId,
      version: 1,
      module: "gateway-protect",
      status: "published",
      rules: [
        {
          id: "email",
          effect: "TOKENIZE",
          priority: 100,
          enabled: true,
          actions: [],
          entityTypes: ["email"],
          conditions: [],
        },
      ],
      publishedAt: "2026-05-27T12:00:00.000Z",
    };
  }

  private connectorConnection(status: ConnectorConnectionSummary["status"]): ConnectorConnectionSummary {
    return {
      id: connectorConnectionId,
      organizationId,
      provider: "google-drive",
      status,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      accountLabel: "security@oclushion.test",
      expiresAt: "2026-05-27T13:00:00.000Z",
      createdAt: "2026-05-27T12:00:00.000Z",
      updatedAt: "2026-05-27T12:00:00.000Z",
      revokedAt: null,
    };
  }

  private member(role: OrganizationMemberSummary["role"]): OrganizationMemberSummary {
    return {
      userId: "42b6ec09-cb44-449d-9652-9a891860f1ea",
      email: "security@oclushion.test",
      displayName: "Security",
      role,
      createdAt: "2026-05-27T12:00:00.000Z",
      disabledAt: null,
    };
  }

  private billing(): BillingAccountSummary {
    return {
      organizationId,
      plan: "enterprise",
      status: "active",
      billingEmail: "billing@oclushion.test",
      externalCustomerId: "cus_oclushion_test",
      currentPeriodStart: "2026-05-01T00:00:00.000Z",
      currentPeriodEnd: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-05-27T12:00:00.000Z",
    };
  }
}

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe("control API routes", () => {
  it("calculates own-credit usage from token counts", () => {
    expect(calculateCreditsForTokens({ model: "gpt-4o", inputTokens: 1200, outputTokens: 800 })).toEqual({
      totalTokens: 2000,
      credits: 12,
    });
    expect(calculateCreditsForTokens({ model: "gpt-4o-mini", inputTokens: 1, outputTokens: 1 }).credits).toBe(1);
  });

  it("returns a desktop session with the user's plan", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "developer@oclushion.local", password: "correct-password" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        email: "developer@oclushion.local",
        plan: "Pro",
      },
    });
  }, 60_000);

  it("registers a native desktop user and returns a session", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        name: "Native Developer",
        email: "native@oclushion.local",
        password: "C0rrect-Password!",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      token: expect.any(String),
      user: {
        email: "native@oclushion.local",
        name: "Native Developer",
        plan: "Free",
        organizationId,
      },
    });
    expect(repository.calls).toContain("createDesktopAuthUser");
  }, 60_000);

  it("allows desktop auth CORS preflight requests", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const response = await app.inject({
      method: "OPTIONS",
      url: "/v1/auth/register",
      headers: {
        origin: "http://tauri.localhost",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(response.statusCode).toBe(204);
  }, 60_000);

  it("rejects native desktop registration when the email already exists", async () => {
    const repository = new FakeRepository();
    repository.duplicateDesktopRegistration = true;
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        name: "Native Developer",
        email: "developer@oclushion.local",
        password: "C0rrect-Password!",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "An Oclushion account already exists for this email.",
    });
  }, 60_000);

  it("separates liveness and dependency readiness", async () => {
    const repository = new FakeRepository();
    repository.ready = false;
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);

    expect((await app.inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({ status: "unavailable" });
  }, 60_000);

  it("protects control plane mutations with the bootstrap bearer token", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/organizations",
      payload: { name: "Oclushion Test", slug: "oclushion-test", ownerEmail: "owner@oclushion.test" },
    });

    expect(response.statusCode).toBe(401);
    expect(repository.calls).toEqual([]);
  });

  it("publishes and serves a tenant-scoped snapshot", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);
    const headers = { authorization: `Bearer ${adminToken}` };

    const published = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organizationId}/policies/${policyId}/versions/${policyVersionId}/publish`,
      headers,
    });
    const snapshot = await app.inject({
      method: "GET",
      url: `/v1/organizations/${organizationId}/policies/${policyId}/snapshot`,
      headers,
    });

    expect(published.statusCode).toBe(200);
    expect(snapshot.json()).toMatchObject({ organizationId, policyVersionId, status: "published" });
    expect(repository.calls).toEqual(["publishPolicyVersion", "getPublishedSnapshot"]);
  });

  it("creates tenant-scoped gateway keys and serves internal bound snapshots", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, {
      adminToken,
      internalToken: "phase2-internal-token-that-is-long-enough",
      enableRateLimiting: false,
    });
    apps.add(app);

    const key = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organizationId}/gateway-api-keys`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Gateway key", scopes: ["proxy:invoke"] },
    });
    const binding = await app.inject({
      method: "PUT",
      url: `/v1/organizations/${organizationId}/modules/gateway-protect/policy-binding`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { policyId },
    });
    const internal = await app.inject({
      method: "GET",
      url: `/v1/internal/organizations/${organizationId}/modules/gateway-protect/snapshot`,
      headers: { authorization: "Bearer phase2-internal-token-that-is-long-enough" },
    });

    expect(key.statusCode).toBe(201);
    expect(key.json()).toMatchObject({ organizationId, scopes: ["proxy:invoke"] });
    expect(binding.statusCode).toBe(200);
    expect(internal.statusCode).toBe(200);
    expect(repository.calls).toEqual([
      "createGatewayApiKey",
      "bindModulePolicy",
      "getBoundPublishedSnapshot",
    ]);
  });

  it("accepts browser protect audit events without raw prompt content", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/browser/audit-events",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId,
        module: "browser-protect",
        action: "browser_prompt_submit",
        eventType: "browser.protection_decision",
        decision: "TOKENIZE",
        status: "allowed",
        detectionCounts: { email: 1 },
        metadata: { host: "chatgpt.com", selector: "#prompt-textarea", promptLength: 17 },
      },
    });

    expect(response.statusCode).toBe(202);
    expect(repository.calls).toContain("recordBrowserAuditEvent");
  });

  it("manages connector OAuth without returning credential material", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);
    const headers = { authorization: `Bearer ${adminToken}` };

    const catalog = await app.inject({ method: "GET", url: "/v1/connectors/catalog", headers });
    const start = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organizationId}/connectors/google-drive/oauth/start`,
      headers,
      payload: {
        clientId: "oclushion-local-client",
        redirectUri: "http://127.0.0.1:3000/oauth/callback",
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      },
    });
    const complete = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organizationId}/connectors/google-drive/oauth/complete`,
      headers,
      payload: {
        state: "oauth-state-long-enough",
        accessToken: "access-token-secret",
        refreshToken: "refresh-token-secret",
        accountLabel: "security@oclushion.test",
      },
    });
    const connections = await app.inject({
      method: "GET",
      url: `/v1/organizations/${organizationId}/connectors`,
      headers,
    });
    const revoke = await app.inject({
      method: "DELETE",
      url: `/v1/organizations/${organizationId}/connectors/${connectorConnectionId}`,
      headers,
    });

    expect(catalog.statusCode).toBe(200);
    expect(start.statusCode).toBe(201);
    expect(complete.statusCode).toBe(201);
    expect(JSON.stringify(complete.json())).not.toContain("refresh-token-secret");
    expect(connections.statusCode).toBe(200);
    expect(revoke.statusCode).toBe(204);
    expect(repository.calls).toEqual([
      "startConnectorOAuth",
      "completeConnectorOAuth",
      "listConnectorConnections",
      "revokeConnectorConnection",
    ]);
  });

  it("manages identity, billing, usage and launch readiness", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);
    const headers = { authorization: `Bearer ${adminToken}` };

    const member = await app.inject({
      method: "PUT",
      url: `/v1/organizations/${organizationId}/members`,
      headers,
      payload: {
        email: "security@oclushion.test",
        displayName: "Security",
        role: "security_officer",
      },
    });
    const billing = await app.inject({
      method: "PUT",
      url: `/v1/organizations/${organizationId}/billing`,
      headers,
      payload: {
        plan: "enterprise",
        status: "active",
        billingEmail: "billing@oclushion.test",
      },
    });
    const usage = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organizationId}/usage-events`,
      headers,
      payload: {
        module: "gateway-protect",
        eventName: "request.sanitized",
        quantity: 3,
        idempotencyKey: "usage-test-1",
      },
    });
    const creditDebit = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organizationId}/credits/debit`,
      headers,
      payload: {
        userId: "7f2cff3c-c43a-472e-a74c-224321b04653",
        provider: "openai",
        model: "gpt-4o",
        inputTokens: 1200,
        outputTokens: 800,
        idempotencyKey: "credit-debit-1",
      },
    });
    const creditBalance = await app.inject({
      method: "GET",
      url: `/v1/organizations/${organizationId}/credits/balance`,
      headers,
    });
    const readiness = await app.inject({
      method: "GET",
      url: `/v1/organizations/${organizationId}/launch-readiness`,
      headers,
    });

    expect(member.statusCode).toBe(200);
    expect(member.json()).toMatchObject({ role: "security_officer" });
    expect(billing.statusCode).toBe(200);
    expect(billing.json()).toMatchObject({ plan: "enterprise", status: "active" });
    expect(usage.statusCode).toBe(201);
    expect(creditDebit.statusCode).toBe(201);
    expect(creditDebit.json()).toMatchObject({
      totalTokens: 2000,
      creditsDelta: -12,
      idempotencyKey: "credit-debit-1",
    });
    expect(creditBalance.json()).toMatchObject({ organizationId, balance: -2 });
    expect(readiness.json()).toMatchObject({ productionReady: true });
    expect(repository.calls).toEqual([
      "upsertOrganizationMember",
      "upsertBillingAccount",
      "recordUsageEvent",
      "debitCredits",
      "getCreditBalance",
      "getLaunchReadiness",
    ]);
  });

  it("rejects invalid tenant identifiers before storage access", async () => {
    const repository = new FakeRepository();
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    apps.add(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/organizations/not-a-tenant/policies",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Gateway protection", module: "gateway-protect" },
    });

    expect(response.statusCode).toBe(400);
    expect(repository.calls).toEqual([]);
  });
});
