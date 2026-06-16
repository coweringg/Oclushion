import { readFile, readdir } from "node:fs/promises";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { PostgresControlRepository } from "../src/storage/repository.js";

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const integrationDescribe = databaseUrl ? describe : describe.skip;
const adminToken = "phase1-integration-admin-token-long-enough";

integrationDescribe("Postgres control repository", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const repository = new PostgresControlRepository(pool);

  beforeAll(async () => {
    const sqlDir = new URL("../sql/", import.meta.url);
    const files = (await readdir(sqlDir))
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const migration = await readFile(new URL(file, sqlDir), "utf8");
      await pool.query(migration);
    }
  });

  afterAll(async () => {
    await pool.query("DROP TRIGGER IF EXISTS test_reject_publish_audit ON platform_audit_events");
    await pool.query("DROP FUNCTION IF EXISTS test_reject_publish_audit()");
    await pool.end();
  });

  it("publishes a tenant snapshot through HTTP and persists audit evidence", async () => {
    const app = await createApp(repository, { adminToken, enableRateLimiting: false });
    const headers = { authorization: `Bearer ${adminToken}` };
    const suffix = Date.now();

    const organizationResponse = await app.inject({
      method: "POST",
      url: "/v1/organizations",
      headers,
      payload: {
        name: "Integration Tenant",
        slug: `integration-${suffix}`,
        ownerEmail: `integration-${suffix}@oclushion.test`,
      },
    });
    const organization = organizationResponse.json<{ id: string }>();
    const policyResponse = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organization.id}/policies`,
      headers,
      payload: { name: "Gateway PII", module: "gateway-protect" },
    });
    const policy = policyResponse.json<{ id: string }>();
    const versionResponse = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organization.id}/policies/${policy.id}/versions`,
      headers,
      payload: {
        rules: [{ id: "email", entityTypes: ["email"], effect: "TOKENIZE" }],
      },
    });
    const version = versionResponse.json<{ id: string }>();
    const publishedResponse = await app.inject({
      method: "POST",
      url: `/v1/organizations/${organization.id}/policies/${policy.id}/versions/${version.id}/publish`,
      headers,
    });
    const storedResponse = await app.inject({
      method: "GET",
      url: `/v1/organizations/${organization.id}/policies/${policy.id}/snapshot`,
      headers,
    });
    const published = publishedResponse.json<{ status: string }>();
    const stored = storedResponse.json<{ policyVersionId: string }>();
    const audit = await pool.query<{ event_type: string }>(
      `SELECT event_type
       FROM platform_audit_events
       WHERE organization_id = $1 AND policy_version_id = $2
       ORDER BY occurred_at DESC`,
      [organization.id, version.id],
    );

    expect(organizationResponse.statusCode).toBe(201);
    expect(policyResponse.statusCode).toBe(201);
    expect(versionResponse.statusCode).toBe(201);
    expect(publishedResponse.statusCode).toBe(200);
    expect(storedResponse.statusCode).toBe(200);
    expect(published.status).toBe("published");
    expect(stored.policyVersionId).toBe(version.id);
    expect(audit.rows.map((row) => row.event_type)).toContain("policy.published");

    await repository.bindModulePolicy({
      organizationId: organization.id,
      module: "gateway-protect",
      policyId: policy.id,
    });
    const bound = await repository.getBoundPublishedSnapshot({
      organizationId: organization.id,
      module: "gateway-protect",
    });
    const key = await repository.createGatewayApiKey({
      organizationId: organization.id,
      name: "Gateway integration key",
      scopes: ["proxy:invoke"],
      createdBy: "integration-test",
    });

    expect(bound.policyVersionId).toBe(version.id);
    expect(key.apiKey).toMatch(/^oclushion_live_/);
    await repository.revokeGatewayApiKey({
      organizationId: organization.id,
      apiKeyId: key.id,
    });
    await app.close();
  }, 60_000);

  it("stores connector credentials encrypted and destroys them on revocation", async () => {
    const organization = await repository.createOrganization({
      name: "Connector Tenant",
      slug: `connector-${Date.now()}`,
      ownerEmail: `connector-${Date.now()}@oclushion.test`,
    });
    const start = await repository.startConnectorOAuth({
      organizationId: organization.id,
      provider: "google-drive",
      clientId: "oclushion-local-client",
      redirectUri: "http://127.0.0.1:3000/oauth/callback",
      requestedScopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const connection = await repository.completeConnectorOAuth({
      organizationId: organization.id,
      provider: "google-drive",
      state: start.state,
      accessToken: "access-token-secret",
      refreshToken: "refresh-token-secret",
      accountLabel: "drive-test@oclushion.test",
    });
    const stored = await pool.query<{
      access_token_ciphertext: string | null;
      refresh_token_ciphertext: string | null;
      status: string;
    }>(
      `SELECT access_token_ciphertext, refresh_token_ciphertext, status
       FROM connector_connections
       WHERE id = $1 AND organization_id = $2`,
      [connection.id, organization.id],
    );

    expect(stored.rows[0]?.access_token_ciphertext).not.toContain("access-token-secret");
    expect(stored.rows[0]?.refresh_token_ciphertext).not.toContain("refresh-token-secret");
    expect(stored.rows[0]?.status).toBe("active");

    await repository.revokeConnectorConnection({
      organizationId: organization.id,
      connectionId: connection.id,
    });
    const revoked = await pool.query<{
      access_token_ciphertext: string | null;
      refresh_token_ciphertext: string | null;
      status: string;
      revoked_at: Date | null;
    }>(
      `SELECT access_token_ciphertext, refresh_token_ciphertext, status, revoked_at
       FROM connector_connections
       WHERE id = $1 AND organization_id = $2`,
      [connection.id, organization.id],
    );

    expect(revoked.rows[0]?.status).toBe("revoked");
    expect(revoked.rows[0]?.access_token_ciphertext).toBeNull();
    expect(revoked.rows[0]?.refresh_token_ciphertext).toBeNull();
    expect(revoked.rows[0]?.revoked_at).toBeInstanceOf(Date);
  });

  it("persists identity and billing readiness controls", async () => {
    const organization = await repository.createOrganization({
      name: "Launch Tenant",
      slug: `launch-${Date.now()}`,
      ownerEmail: `launch-${Date.now()}@oclushion.test`,
    });
    const member = await repository.upsertOrganizationMember({
      organizationId: organization.id,
      email: "security-officer@oclushion.test",
      displayName: "Security Officer",
      role: "security_officer",
    });
    const billing = await repository.upsertBillingAccount({
      organizationId: organization.id,
      plan: "enterprise",
      status: "active",
      billingEmail: "billing@oclushion.test",
    });
    const usage = await repository.recordUsageEvent({
      organizationId: organization.id,
      module: "gateway-protect",
      eventName: "request.sanitized",
      quantity: 5,
      idempotencyKey: `usage-${Date.now()}`,
    });
    const summary = await repository.getUsageSummary({ organizationId: organization.id });
    const readiness = await repository.getLaunchReadiness({ organizationId: organization.id });

    expect(member.role).toBe("security_officer");
    expect(billing.status).toBe("active");
    expect(usage.quantity).toBe(5);
    expect(summary.totalQuantity).toBeGreaterThanOrEqual(5);
    expect(readiness.checks.map((check) => check.id)).toContain("billing-active");
  });

  it("rolls back publication if durable audit insertion fails", async () => {
    const organization = await repository.createOrganization({
      name: "Fail Closed Tenant",
      slug: `fail-closed-${Date.now()}`,
      ownerEmail: `fail-closed-${Date.now()}@oclushion.test`,
    });
    const policy = await repository.createPolicySet({
      organizationId: organization.id,
      name: "Protected publishing",
      module: "gateway-protect",
    });
    const version = await repository.createPolicyVersion({
      organizationId: organization.id,
      policyId: policy.id,
      rules: [
        {
          id: "private-key",
          priority: 1,
          enabled: true,
          actions: [],
          entityTypes: ["private_key"],
          effect: "BLOCK",
          conditions: [],
        },
      ],
    });
    await pool.query(`
      CREATE OR REPLACE FUNCTION test_reject_publish_audit()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.event_type = 'policy.published' THEN
          RAISE EXCEPTION 'audit storage unavailable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS test_reject_publish_audit ON platform_audit_events;
      CREATE TRIGGER test_reject_publish_audit
      BEFORE INSERT ON platform_audit_events
      FOR EACH ROW EXECUTE FUNCTION test_reject_publish_audit();
    `);

    await expect(
      repository.publishPolicyVersion({
        organizationId: organization.id,
        policyId: policy.id,
        policyVersionId: version.id,
      }),
    ).rejects.toThrow("audit storage unavailable");
    await expect(
      repository.getPublishedSnapshot({ organizationId: organization.id, policyId: policy.id }),
    ).rejects.toThrow("Published policy snapshot does not exist.");

    await pool.query("DROP TRIGGER IF EXISTS test_reject_publish_audit ON platform_audit_events");
  });
});
