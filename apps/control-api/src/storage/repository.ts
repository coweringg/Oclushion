import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { Pool, PoolClient, QueryResultRow } from "pg";

import {
  connectorProviderSchema,
  createOAuthStart,
  encryptSecret,
  hashState,
  safeCompareStateHash,
  validateConnectorScopes,
  type ConnectorProvider,
} from "@oclushion/connectors";
import {
  policySnapshotSchema,
  type PolicyRule,
  type PolicySnapshot,
  type PolicyTargetModule,
} from "@oclushion/shared";

import { calculateCreditsForTokens } from "../billing/credits.js";

export type CreatedOrganization = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
};

export type CreatedPolicySet = {
  id: string;
  organizationId: string;
  name: string;
  module: PolicyTargetModule;
  createdAt: string;
};

export type DraftPolicyVersion = {
  id: string;
  policyId: string;
  organizationId: string;
  version: number;
  rules: PolicyRule[];
  status: "draft";
  createdAt: string;
};

export type CreatedGatewayApiKey = {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  apiKey: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
};

export type ConnectorOAuthStartResult = {
  provider: ConnectorProvider;
  authorizationUrl: string;
  state: string;
  scopes: string[];
  expiresAt: string;
};

export type ConnectorConnectionSummary = {
  id: string;
  organizationId: string;
  provider: ConnectorProvider;
  status: "pending" | "active" | "revoked" | "failed";
  scopes: string[];
  accountLabel: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type OrganizationMemberSummary = {
  userId: string;
  email: string;
  displayName: string | null;
  role: "owner" | "admin" | "security_officer" | "auditor" | "developer" | "viewer";
  createdAt: string;
  disabledAt: string | null;
};

export type BillingAccountSummary = {
  organizationId: string;
  plan: "free" | "pro" | "team" | "enterprise";
  status: "trialing" | "active" | "past_due" | "canceled";
  billingEmail: string;
  externalCustomerId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  updatedAt: string;
};

export type UsageMeterEvent = {
  id: string;
  organizationId: string;
  module: PolicyTargetModule;
  eventName: string;
  quantity: number;
  occurredAt: string;
};

export type UsageSummary = {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  totalQuantity: number;
  byModule: Array<{ module: string; quantity: number }>;
};

export type CreditLedgerEntry = {
  id: string;
  organizationId: string;
  userId: string | null;
  type: "grant" | "debit" | "adjustment";
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  creditsDelta: number;
  balanceAfter: number;
  idempotencyKey: string;
  occurredAt: string;
};

export type CreditBalanceSummary = {
  organizationId: string;
  balance: number;
};

export type SpendCapSummary = {
  organizationId: string;
  dailySpendLimit: number;
  currentDailySpend: number;
  dailySpendDate: string;
};

export type LaunchReadiness = {
  organizationId: string;
  productionReady: boolean;
  checks: Array<{ id: string; label: string; passed: boolean; detail: string }>;
};

export type DesktopAuthUser = {
  userId: string;
  email: string;
  displayName: string | null;
  organizationId: string;
  role: OrganizationMemberSummary["role"];
  plan: BillingAccountSummary["plan"];
  planRenewalDate: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  idpId: string | null;
  idpProvider: string | null;
  authMethod: "password" | "sso" | "password_sso";
  totpSecret: string | null;
  totpEnabledAt: string | null;
  totpRecoveryCodes: string[] | null;
};

export type CreateDesktopAuthUserInput = {
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  idpId?: string;
  idpProvider?: string;
  authMethod?: "password" | "sso" | "password_sso";
};

export interface ControlRepository {
  ping(): Promise<void>;
  ensureOrganization(input: {
    organizationId: string;
    name: string;
    slug: string;
    ownerEmail: string;
  }): Promise<CreatedOrganization>;
  getOrganization(input: {
    organizationId: string;
  }): Promise<{ id: string; name: string; slug: string; plan: string }>;

  createOrganization(input: {
    name: string;
    slug: string;
    ownerEmail: string;
  }): Promise<CreatedOrganization>;
  createPolicySet(input: {
    organizationId: string;
    name: string;
    module: PolicyTargetModule;
  }): Promise<CreatedPolicySet>;
  createPolicyVersion(input: {
    organizationId: string;
    policyId: string;
    rules: PolicyRule[];
  }): Promise<DraftPolicyVersion>;
  publishPolicyVersion(input: {
    organizationId: string;
    policyId: string;
    policyVersionId: string;
  }): Promise<PolicySnapshot>;
  getPublishedSnapshot(input: {
    organizationId: string;
    policyId: string;
  }): Promise<PolicySnapshot>;
  createGatewayApiKey(input: {
    organizationId: string;
    name: string;
    scopes: string[];
    createdBy: string;
    expiresAt?: string;
  }): Promise<CreatedGatewayApiKey>;
  listGatewayApiKeys(input: { organizationId: string }): Promise<
    Array<{
      id: string;
      organizationId: string;
      name: string;
      keyPrefix: string;
      scopes: string[];
      createdAt: string;
      lastUsedAt: string | null;
      revokedAt: string | null;
      expiresAt: string | null;
      lastRotatedAt: string | null;
      rotationCount: number;
    }>
  >;
  revokeGatewayApiKey(input: { organizationId: string; apiKeyId: string }): Promise<void>;
  rotateGatewayApiKey(input: { organizationId: string; apiKeyId: string }): Promise<CreatedGatewayApiKey>;
  listExpiringApiKeys(input: { withinDays: number }): Promise<Array<{ id: string; organizationId: string; name: string; keyPrefix: string; expiresAt: string }>>;
  bindModulePolicy(input: {
    organizationId: string;
    module: PolicyTargetModule;
    policyId: string;
  }): Promise<void>;
  upsertModulePolicy(input: {
    organizationId: string;
    module: PolicyTargetModule;
    name: string;
    rules: PolicyRule[];
  }): Promise<PolicySnapshot>;
  getBoundPublishedSnapshot(input: {
    organizationId: string;
    module: PolicyTargetModule;
  }): Promise<PolicySnapshot>;
  listBoundPublishedSnapshots(input: {
    organizationId: string;
  }): Promise<PolicySnapshot[]>;
  getDashboardOverview(input: { organizationId: string }): Promise<{
    requestCount: number;
    tokenCount: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    activeProviders: number;
    pendingEvents: number;
    modules: Array<{
      module: string;
      events: number;
      lastEventAt: string | null;
      status: "active" | "inactive";
    }>;
    timeseries: Array<{ label: string; requests: number; latencyMs: number }>;
    entities: Array<{ type: string; count: number }>;
  }>;
  listAuditEvents(input: { organizationId: string; page: number; pageSize: number }): Promise<{
    events: Array<{
      id: string;
      requestId: string;
      module: string;
      provider: string;
      decision: string | null;
      status: string;
      detectionCounts: Record<string, number>;
      upstreamStatus: number | null;
      overheadMs: number;
      createdAt: string;
    }>;
    page: number;
    totalPages: number;
    total: number;
  }>;
  recordBrowserAuditEvent(input: {
    organizationId: string;
    action: string;
    decision: "ALLOW" | "TOKENIZE" | "BLOCK" | "REQUIRE_APPROVAL";
    status: "allowed" | "blocked" | "pending_approval" | "failed";
    detectionCounts: Record<string, number>;
    metadata: Record<string, string | number | boolean>;
  }): Promise<void>;
  startConnectorOAuth(input: {
    organizationId: string;
    provider: ConnectorProvider;
    clientId: string;
    redirectUri: string;
    requestedScopes?: string[];
  }): Promise<ConnectorOAuthStartResult>;
  completeConnectorOAuth(input: {
    organizationId: string;
    provider: ConnectorProvider;
    state: string;
    accessToken: string;
    refreshToken?: string;
    accountLabel?: string;
    expiresAt?: string;
  }): Promise<ConnectorConnectionSummary>;
  listConnectorConnections(input: {
    organizationId: string;
  }): Promise<ConnectorConnectionSummary[]>;
  revokeConnectorConnection(input: {
    organizationId: string;
    connectionId: string;
  }): Promise<void>;
  listOrganizationMembers(input: { organizationId: string }): Promise<OrganizationMemberSummary[]>;
  upsertOrganizationMember(input: {
    organizationId: string;
    email: string;
    role: OrganizationMemberSummary["role"];
    displayName?: string;
  }): Promise<OrganizationMemberSummary>;
  disableOrganizationMember(input: { organizationId: string; userId: string }): Promise<void>;
  removeOrganizationMember(input: { organizationId: string; email: string }): Promise<void>;
  getDesktopAuthUser(input: { userId: string }): Promise<DesktopAuthUser>;
  upsertBillingAccount(input: {
    organizationId: string;
    plan: BillingAccountSummary["plan"];
    status: BillingAccountSummary["status"];
    billingEmail: string;
    externalCustomerId?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
  }): Promise<BillingAccountSummary>;
  getBillingAccount(input: { organizationId: string }): Promise<BillingAccountSummary>;
  recordUsageEvent(input: {
    organizationId: string;
    module: PolicyTargetModule;
    eventName: string;
    quantity: number;
    idempotencyKey: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<UsageMeterEvent>;
  getUsageSummary(input: { organizationId: string }): Promise<UsageSummary>;
  debitCredits(input: {
    organizationId: string;
    userId?: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    idempotencyKey: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<CreditLedgerEntry>;
  grantCredits(input: {
    organizationId: string;
    userId?: string;
    credits: number;
    provider: string;
    idempotencyKey: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<CreditLedgerEntry>;
  getCreditBalance(input: { organizationId: string }): Promise<CreditBalanceSummary>;
  getSpendCap(input: { organizationId: string }): Promise<SpendCapSummary>;
  updateSpendCap(input: { organizationId: string; dailySpendLimit: number }): Promise<SpendCapSummary>;
  getLaunchReadiness(input: { organizationId: string }): Promise<LaunchReadiness>;
  getDesktopAuthUserByEmail(input: { email: string }): Promise<DesktopAuthUser>;
  createDesktopAuthUser(input: CreateDesktopAuthUserInput): Promise<DesktopAuthUser>;
  enableMfa(input: { userId: string; totpSecret: string; recoveryCodes: string[] }): Promise<void>;
  disableMfa(input: { userId: string }): Promise<void>;
  consumeMfaRecoveryCode(input: { userId: string; codeIndex: number }): Promise<void>;
  recordDesktopAuditEvents(input: {
    organizationId: string;
    actorId: string;
    events: Array<{
      type: string;
      summary: string;
      metadata: Record<string, string | number | boolean | null>;
      timestamp: string;
    }>;
  }): Promise<void>;
  listOrganizations(): Promise<Array<{
    id: string;
    slug: string;
    name: string;
    plan: string;
    auditRetentionDays: number;
  }>>;
  deleteAuditEventsOlderThan(input: {
    organizationId: string;
    cutoffDate: Date;
  }): Promise<void>;
  exportAuditEvents(input: {
    organizationId: string;
    from?: Date;
    to?: Date;
  }): Promise<Array<{
    id: string;
    eventType: string;
    status: string;
    decision: string | null;
    actorId: string | null;
    occurredAt: string;
    summary: string;
    metadata: Record<string, unknown>;
  }>>;
  upsertAuditWebhook(input: {
    organizationId: string;
    url: string;
    secret: string;
    eventTypes: string[];
  }): Promise<void>;
  getSSOConnectionByDomain(input: {
    domain: string;
  }): Promise<{
    id: string;
    organizationId: string;
    provider: string;
    domain: string;
    idpMetadata: Record<string, unknown> | null;
    clientId: string | null;
    enabled: boolean;
    roleMappings: Array<{ idpGroup: string; oclushionRole: string }>;
  } | null>;
  listSSOConnections(input: {
    organizationId: string;
  }): Promise<Array<{
    id: string;
    provider: string;
    domain: string;
    enabled: boolean;
    createdAt: string;
  }>>;
  upsertSSOConnection(input: {
    organizationId: string;
    provider: string;
    domain: string;
    idpMetadata?: Record<string, unknown>;
    clientId?: string;
    clientSecret?: string;
    roleMappings?: Array<{ idpGroup: string; oclushionRole: string }>;
  }): Promise<void>;
  deleteSSOConnection(input: {
    organizationId: string;
    connectionId: string;
  }): Promise<void>;

  validateScimToken(input: { tokenHash: string }): Promise<{
    id: string;
    organization_id: string;
    token_hash: string;
    token_prefix: string;
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
  } | null>;

  touchScimToken(input: { tokenHash: string }): Promise<void>;

  createScimToken(input: {
    organizationId: string;
    tokenHash: string;
    tokenPrefix: string;
    name: string;
    description?: string;
    expiresAt?: string;
  }): Promise<{ id: string }>;

  listScimTokens(input: {
    organizationId: string;
  }): Promise<Array<{
    id: string;
    token_prefix: string;
    name: string;
    description: string | null;
    last_used_at: string | null;
    created_at: string;
    expires_at: string | null;
    revoked_at: string | null;
  }>>;

  revokeScimToken(input: { organizationId: string; tokenId: string }): Promise<void>;

  createInvitation(input: {
    organizationId: string;
    email: string;
    role: string;
    invitedBy: string;
  }): Promise<{ id: string; invitationCode: string; expiresAt: string }>;

  validateInvitation(input: {
    code: string;
  }): Promise<{ id: string; organizationId: string; email: string; role: string } | null>;

  markInvitationAccepted(input: {
    id: string;
    acceptedBy: string;
  }): Promise<void>;

  createPairingCode(input: {
    organizationId: string;
    createdBy: string;
  }): Promise<{ id: string; code: string; expiresAt: string }>;

  validatePairingCode(input: {
    code: string;
  }): Promise<{ id: string; organizationId: string } | null>;

  startTrial(input: {
    organizationId: string;
    durationDays?: number;
    maxMembers?: number;
  }): Promise<void>;

  getTrialStatus(input: {
    organizationId: string;
  }): Promise<{
    active: boolean;
    expired?: boolean;
    daysLeft?: number;
    message?: string;
  }>;

  convertTrialToPaid(input: {
    organizationId: string;
    plan: string;
  }): Promise<void>;

  listExpiringTrials(input: {
    withinDays: number;
  }): Promise<Array<{
    organizationId: string;
    organizationName: string;
    trialEndsAt: string;
  }>>;
}

export class RepositoryNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RepositoryNotFoundError";
  }
}

export class RepositoryConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RepositoryConflictError";
  }
}

export class SpendLimitReachedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SpendLimitReachedError";
  }
}

type OrganizationRow = QueryResultRow & {
  id: string;
  slug: string;
  name: string;
  created_at: Date;
};

type PolicySetRow = QueryResultRow & {
  id: string;
  organization_id: string;
  name: string;
  module_name: PolicyTargetModule;
  created_at: Date;
};

type PolicyVersionRow = QueryResultRow & {
  id: string;
  policy_set_id: string;
  organization_id: string;
  version: number;
  rules: PolicyRule[];
  status: "draft" | "published";
  created_at: Date;
  published_at: Date | null;
  module_name: PolicyTargetModule;
};

type GatewayApiKeyRow = QueryResultRow & {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date | null;
};

type ConnectorOAuthStateRow = QueryResultRow & {
  id: string;
  provider: ConnectorProvider;
  state_hash: string;
  scopes: string[];
  expires_at: Date;
};

type ConnectorConnectionRow = QueryResultRow & {
  id: string;
  organization_id: string;
  provider: ConnectorProvider;
  status: "pending" | "active" | "revoked" | "failed";
  scopes: string[];
  account_label: string | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  revoked_at: Date | null;
};

type OrganizationMemberRow = QueryResultRow & {
  user_id: string;
  email: string;
  display_name: string | null;
  role: OrganizationMemberSummary["role"];
  created_at: Date;
  disabled_at: Date | null;
};

type BillingAccountRow = QueryResultRow & {
  organization_id: string;
  plan: BillingAccountSummary["plan"];
  status: BillingAccountSummary["status"];
  billing_email: string;
  external_customer_id: string | null;
  current_period_start: Date;
  current_period_end: Date;
  updated_at: Date;
};

type UsageMeterRow = QueryResultRow & {
  id: string;
  organization_id: string;
  module_name: PolicyTargetModule;
  event_name: string;
  quantity: number;
  occurred_at: Date;
};

type CreditLedgerRow = QueryResultRow & {
  id: string;
  organization_id: string;
  user_id: string | null;
  entry_type: CreditLedgerEntry["type"];
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  credits_delta: number;
  idempotency_key: string;
  occurred_at: Date;
};

export class PostgresControlRepository implements ControlRepository {
  public constructor(
    private readonly pool: Pool,
    private readonly connectorVaultKey = readConnectorVaultKey(),
  ) {}

  public async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  public async getOrganization(input: {
    organizationId: string;
  }): Promise<{ id: string; name: string; slug: string; plan: string }> {
    const result = await this.pool.query<{ id: string; name: string; slug: string; plan: string }>(
      `SELECT id::text, name, slug, plan FROM organizations WHERE id = $1`,
      [input.organizationId],
    );
    return requiredRow(result.rows[0], "Organization not found");
  }

  public async createOrganization(input: {
    name: string;
    slug: string;
    ownerEmail: string;
  }): Promise<CreatedOrganization> {
    return this.inTransaction(async (client) => {
      const result = await client.query<OrganizationRow>(
        `INSERT INTO organizations (name, slug)
         VALUES ($1, $2)
         RETURNING id, name, slug, created_at`,
        [input.name, input.slug],
      );
      const organization = requiredRow(result.rows[0], "Organization was not created.");
      const owner = await client.query<{ id: string } & QueryResultRow>(
        `INSERT INTO platform_users (email)
         VALUES ($1)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [input.ownerEmail.toLowerCase()],
      );
      const ownerId = requiredRow(owner.rows[0], "Organization owner was not created.").id;
      await client.query(
        `INSERT INTO organization_memberships (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [organization.id, ownerId],
      );
      await this.recordAudit(client, {
        organizationId: organization.id,
        actorId: ownerId,
        module: "control-plane",
        eventType: "organization.created",
      });

      return serializeOrganization(organization);
    });
  }

  public async ensureOrganization(input: {
    organizationId: string;
    name: string;
    slug: string;
    ownerEmail: string;
  }): Promise<CreatedOrganization> {
    return this.inTransaction(async (client) => {
      const result = await client.query<OrganizationRow>(
        `INSERT INTO organizations (id, name, slug)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug
         RETURNING id, name, slug, created_at`,
        [input.organizationId, input.name, input.slug],
      );
      const organization = requiredRow(result.rows[0], "Organization was not ensured.");
      const owner = await client.query<{ id: string } & QueryResultRow>(
        `INSERT INTO platform_users (email)
         VALUES ($1)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [input.ownerEmail.toLowerCase()],
      );
      const ownerId = requiredRow(owner.rows[0], "Organization owner was not ensured.").id;
      await client.query(
        `INSERT INTO organization_memberships (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [organization.id, ownerId],
      );
      return serializeOrganization(organization);
    });
  }

  public async createPolicySet(input: {
    organizationId: string;
    name: string;
    module: PolicyTargetModule;
  }): Promise<CreatedPolicySet> {
    return this.inTransaction(async (client) => {
      const result = await client.query<PolicySetRow>(
        `INSERT INTO policy_sets (organization_id, name, module_name)
         VALUES ($1, $2, $3)
         RETURNING id, organization_id, name, module_name, created_at`,
        [input.organizationId, input.name, input.module],
      );
      const row = requiredRow(result.rows[0], "Policy set was not created.");
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: input.module,
        eventType: "policy.created",
        policyId: row.id,
      });
      return {
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        module: row.module_name,
        createdAt: row.created_at.toISOString(),
      };
    });
  }

  public async createPolicyVersion(input: {
    organizationId: string;
    policyId: string;
    rules: PolicyRule[];
  }): Promise<DraftPolicyVersion> {
    return this.inTransaction(async (client) => {
      const policy = await this.requirePolicy(client, input.organizationId, input.policyId);
      const versionResult = await client.query<PolicyVersionRow>(
        `INSERT INTO policy_versions
           (policy_set_id, organization_id, version, rules, status)
         SELECT $1, $2, COALESCE(MAX(version), 0) + 1, $3::jsonb, 'draft'
         FROM policy_versions
         WHERE policy_set_id = $1
         RETURNING id, policy_set_id, organization_id, version, rules, status,
                   created_at, published_at`,
        [input.policyId, input.organizationId, JSON.stringify(input.rules)],
      );
      const row = requiredRow(versionResult.rows[0], "Policy version was not created.");
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: policy.module_name,
        eventType: "policy.version_created",
        policyId: input.policyId,
        policyVersionId: row.id,
      });
      return {
        id: row.id,
        policyId: row.policy_set_id,
        organizationId: row.organization_id,
        version: row.version,
        rules: row.rules,
        status: "draft",
        createdAt: row.created_at.toISOString(),
      };
    });
  }

  public async publishPolicyVersion(input: {
    organizationId: string;
    policyId: string;
    policyVersionId: string;
  }): Promise<PolicySnapshot> {
    return this.inTransaction(async (client) => {
      const policy = await this.requirePolicy(client, input.organizationId, input.policyId);
      const target = await client.query<PolicyVersionRow>(
        `SELECT id, policy_set_id, organization_id, version, rules, status,
                created_at, published_at
         FROM policy_versions
         WHERE id = $1 AND policy_set_id = $2 AND organization_id = $3
         FOR UPDATE`,
        [input.policyVersionId, input.policyId, input.organizationId],
      );
      const version = requiredRow(target.rows[0], "Policy version does not exist.");
      await client.query(
        `UPDATE policy_versions
         SET status = 'draft', published_at = NULL
         WHERE policy_set_id = $1 AND status = 'published' AND id <> $2`,
        [input.policyId, input.policyVersionId],
      );
      const publishedAt = new Date();
      await client.query(
        `UPDATE policy_versions
         SET status = 'published', published_at = $1
         WHERE id = $2`,
        [publishedAt, input.policyVersionId],
      );
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: policy.module_name,
        eventType: "policy.published",
        policyId: input.policyId,
        policyVersionId: input.policyVersionId,
      });

      return policySnapshotSchema.parse({
        organizationId: input.organizationId,
        policyId: input.policyId,
        policyVersionId: version.id,
        version: version.version,
        module: policy.module_name,
        status: "published",
        rules: version.rules,
        publishedAt: publishedAt.toISOString(),
      });
    });
  }

  public async getPublishedSnapshot(input: {
    organizationId: string;
    policyId: string;
  }): Promise<PolicySnapshot> {
    const result = await this.pool.query<PolicyVersionRow>(
      `SELECT pv.id, pv.policy_set_id, pv.organization_id, pv.version, pv.rules,
              pv.status, pv.created_at, pv.published_at, ps.module_name
       FROM policy_versions pv
       JOIN policy_sets ps ON ps.id = pv.policy_set_id
       WHERE pv.organization_id = $1 AND pv.policy_set_id = $2
         AND ps.organization_id = $1 AND pv.status = 'published'`,
      [input.organizationId, input.policyId],
    );
    const row = requiredRow(result.rows[0], "Published policy snapshot does not exist.");

    return policySnapshotSchema.parse({
      organizationId: row.organization_id,
      policyId: row.policy_set_id,
      policyVersionId: row.id,
      version: row.version,
      module: row.module_name,
      status: "published",
      rules: row.rules,
      publishedAt: row.published_at?.toISOString(),
    });
  }

  public async createGatewayApiKey(input: {
    organizationId: string;
    name: string;
    scopes: string[];
    createdBy: string;
    expiresAt?: string;
  }): Promise<CreatedGatewayApiKey> {
    return this.inTransaction(async (client) => {
      const id = randomUUID();
      const apiKey = `oclushion_live_${randomBytes(32).toString("base64url")}`;
      const keyPrefix = apiKey.slice(0, 18);
      const salt = randomBytes(16).toString("hex");
      const pepper = process.env.API_KEY_HASH_PEPPER ?? "oclushion-hmac-v1";
      const hash = createHash("sha256").update(salt + apiKey + pepper).digest("hex");
      const keyHash = `v1:${salt}:${hash}`;
      const expiresAt = input.expiresAt ?? (() => {
        const d = new Date();
        d.setDate(d.getDate() + 90);
        return d.toISOString();
      })();
      const result = await client.query<GatewayApiKeyRow>(
        `INSERT INTO client_api_keys
           (id, organization_id, name, key_prefix, key_hash, scopes, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, organization_id, name, key_prefix, scopes, created_at, expires_at`,
        [id, input.organizationId, input.name, keyPrefix, keyHash, input.scopes, input.createdBy, expiresAt],
      );
      const row = requiredRow(result.rows[0], "Gateway API key was not created.");
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "gateway-protect",
        eventType: "gateway_api_key.created",
      });
      return {
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        keyPrefix: row.key_prefix,
        apiKey,
        scopes: row.scopes,
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at?.toISOString() ?? null,
      };
    });
  }

  public async listGatewayApiKeys(input: { organizationId: string }) {
    const result = await this.pool.query<GatewayApiKeyRow>(
      `SELECT id::text, organization_id::text, name, key_prefix, scopes,
              created_at, last_used_at, revoked_at, expires_at, last_rotated_at, rotation_count
       FROM client_api_keys
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [input.organizationId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      scopes: row.scopes,
      createdAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at?.toISOString() ?? null,
      revokedAt: row.revoked_at?.toISOString() ?? null,
      expiresAt: row.expires_at?.toISOString() ?? null,
      lastRotatedAt: row.last_rotated_at?.toISOString() ?? null,
      rotationCount: row.rotation_count ?? 0,
    }));
  }

  public async revokeGatewayApiKey(input: {
    organizationId: string;
    apiKeyId: string;
  }): Promise<void> {
    await this.inTransaction(async (client) => {
      const result = await client.query(
        `UPDATE client_api_keys
         SET revoked_at = NOW()
         WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
         RETURNING id`,
        [input.apiKeyId, input.organizationId],
      );
      requiredRow(result.rows[0], "Gateway API key does not exist.");
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "gateway-protect",
        eventType: "gateway_api_key.revoked",
      });
    });
  }

  public async rotateGatewayApiKey(input: {
    organizationId: string;
    apiKeyId: string;
  }): Promise<CreatedGatewayApiKey> {
    return this.inTransaction(async (client) => {
      const existing = await client.query<GatewayApiKeyRow>(
        `SELECT id, organization_id, name, key_prefix, scopes, key_hash, rotation_count
         FROM client_api_keys
         WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
         FOR UPDATE`,
        [input.apiKeyId, input.organizationId],
      );
      const old = requiredRow(existing.rows[0], "Gateway API key does not exist.");

      const newId = randomUUID();
      const newApiKey = `oclushion_live_${randomBytes(32).toString("base64url")}`;
      const newKeyPrefix = newApiKey.slice(0, 18);
      const salt = randomBytes(16).toString("hex");
      const pepper = process.env.API_KEY_HASH_PEPPER ?? "oclushion-hmac-v1";
      const newHash = createHash("sha256").update(salt + newApiKey + pepper).digest("hex");
      const newKeyHash = `v1:${salt}:${newHash}`;
      const newExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      await client.query(
        `UPDATE client_api_keys
         SET revoked_at = NOW()
         WHERE id = $1`,
        [old.id],
      );

      const result = await client.query<GatewayApiKeyRow>(
        `INSERT INTO client_api_keys
           (id, organization_id, name, key_prefix, key_hash, scopes, created_by,
            expires_at, last_rotated_at, rotation_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
         RETURNING id, organization_id, name, key_prefix, scopes, created_at, expires_at`,
        [newId, input.organizationId, old.name, newKeyPrefix, newKeyHash, old.scopes,
         input.organizationId, newExpiresAt, (old.rotation_count ?? 0) + 1],
      );
      const row = requiredRow(result.rows[0], "Gateway API key rotation failed.");

      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "gateway-protect",
        eventType: "gateway_api_key.rotated",
        metadata: { oldKeyId: old.id, newKeyId: row.id },
      });

      return {
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        keyPrefix: row.key_prefix,
        apiKey: newApiKey,
        scopes: row.scopes,
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at?.toISOString() ?? null,
      };
    });
  }

  public async listExpiringApiKeys(input: { withinDays: number }) {
    const result = await this.pool.query<{ id: string; organization_id: string; name: string; key_prefix: string; expires_at: Date }>(
      `SELECT id::text, organization_id::text, name, key_prefix, expires_at
       FROM client_api_keys
       WHERE revoked_at IS NULL
         AND expires_at IS NOT NULL
         AND expires_at <= NOW() + INTERVAL '1 day' * $1
         AND expires_at > NOW()
       ORDER BY expires_at ASC
       LIMIT 100`,
      [input.withinDays],
    );
    return result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      expiresAt: row.expires_at.toISOString(),
    }));
  }

  public async bindModulePolicy(input: {
    organizationId: string;
    module: PolicyTargetModule;
    policyId: string;
  }): Promise<void> {
    await this.inTransaction(async (client) => {
      const policy = await this.requirePolicy(client, input.organizationId, input.policyId);
      if (policy.module_name !== input.module) {
        throw new RepositoryNotFoundError("Policy module does not match the requested binding.");
      }
      const published = await client.query(
        `SELECT id
         FROM policy_versions
         WHERE policy_set_id = $1 AND organization_id = $2 AND status = 'published'`,
        [input.policyId, input.organizationId],
      );
      requiredRow(published.rows[0], "A published policy version is required before binding.");
      await client.query(
        `INSERT INTO policy_bindings (organization_id, module_name, policy_set_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, module_name)
         DO UPDATE SET policy_set_id = EXCLUDED.policy_set_id, updated_at = NOW()`,
        [input.organizationId, input.module, input.policyId],
      );
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: input.module,
        eventType: "policy.bound",
        policyId: input.policyId,
      });
    });
  }

  public async upsertModulePolicy(input: {
    organizationId: string;
    module: PolicyTargetModule;
    name: string;
    rules: PolicyRule[];
  }): Promise<PolicySnapshot> {
    return this.inTransaction(async (client) => {
      const policyResult = await client.query<PolicySetRow>(
        `INSERT INTO policy_sets (organization_id, name, module_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, name, module_name)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id, organization_id, name, module_name, created_at`,
        [input.organizationId, input.name, input.module],
      );
      const policy = requiredRow(policyResult.rows[0], "Policy set was not upserted.");
      const versionResult = await client.query<PolicyVersionRow>(
        `INSERT INTO policy_versions
           (policy_set_id, organization_id, version, rules, status)
         SELECT $1, $2, COALESCE(MAX(version), 0) + 1, $3::jsonb, 'draft'
         FROM policy_versions
         WHERE policy_set_id = $1
         RETURNING id, policy_set_id, organization_id, version, rules, status,
                   created_at, published_at`,
        [policy.id, input.organizationId, JSON.stringify(input.rules)],
      );
      const version = requiredRow(versionResult.rows[0], "Policy version was not created.");
      await client.query(
        `UPDATE policy_versions
         SET status = 'draft', published_at = NULL
         WHERE policy_set_id = $1 AND status = 'published' AND id <> $2`,
        [policy.id, version.id],
      );
      const publishedAt = new Date();
      await client.query(
        `UPDATE policy_versions
         SET status = 'published', published_at = $1
         WHERE id = $2`,
        [publishedAt, version.id],
      );
      await client.query(
        `INSERT INTO policy_bindings (organization_id, module_name, policy_set_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, module_name)
         DO UPDATE SET policy_set_id = EXCLUDED.policy_set_id, updated_at = NOW()`,
        [input.organizationId, input.module, policy.id],
      );
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: input.module,
        eventType: "policy.upserted",
        policyId: policy.id,
        policyVersionId: version.id,
      });

      return policySnapshotSchema.parse({
        organizationId: input.organizationId,
        policyId: policy.id,
        policyVersionId: version.id,
        version: version.version,
        module: input.module,
        status: "published",
        rules: version.rules,
        publishedAt: publishedAt.toISOString(),
      });
    });
  }

  public async getBoundPublishedSnapshot(input: {
    organizationId: string;
    module: PolicyTargetModule;
  }): Promise<PolicySnapshot> {
    const result = await this.pool.query<PolicyVersionRow>(
      `SELECT pv.id, pv.policy_set_id, pv.organization_id, pv.version, pv.rules,
              pv.status, pv.created_at, pv.published_at, ps.module_name
       FROM policy_bindings pb
       JOIN policy_sets ps ON ps.id = pb.policy_set_id
         AND ps.organization_id = pb.organization_id
         AND ps.module_name = pb.module_name
       JOIN policy_versions pv ON pv.policy_set_id = pb.policy_set_id
         AND pv.organization_id = pb.organization_id
         AND pv.status = 'published'
       WHERE pb.organization_id = $1 AND pb.module_name = $2`,
      [input.organizationId, input.module],
    );
    const row = requiredRow(result.rows[0], "Bound published policy snapshot does not exist.");
    return policySnapshotSchema.parse({
      organizationId: row.organization_id,
      policyId: row.policy_set_id,
      policyVersionId: row.id,
      version: row.version,
      module: row.module_name,
      status: "published",
      rules: row.rules,
      publishedAt: row.published_at?.toISOString(),
    });
  }

  public async listBoundPublishedSnapshots(input: {
    organizationId: string;
  }): Promise<PolicySnapshot[]> {
    const result = await this.pool.query<PolicyVersionRow>(
      `SELECT pv.id, pv.policy_set_id, pv.organization_id, pv.version, pv.rules,
              pv.status, pv.created_at, pv.published_at, ps.module_name
       FROM policy_bindings pb
       JOIN policy_sets ps ON ps.id = pb.policy_set_id
         AND ps.organization_id = pb.organization_id
         AND ps.module_name = pb.module_name
       JOIN policy_versions pv ON pv.policy_set_id = pb.policy_set_id
         AND pv.organization_id = pb.organization_id
         AND pv.status = 'published'
       WHERE pb.organization_id = $1`,
      [input.organizationId],
    );
    return result.rows.map((row) =>
      policySnapshotSchema.parse({
        organizationId: row.organization_id,
        policyId: row.policy_set_id,
        policyVersionId: row.id,
        version: row.version,
        module: row.module_name,
        status: "published",
        rules: row.rules,
        publishedAt: row.published_at?.toISOString(),
      }),
    );
  }

  public async getDashboardOverview(input: { organizationId: string }) {
    const metrics = await this.pool.query<{
      request_count: number;
      token_count: number;
      average_latency_ms: number;
      p95_latency_ms: number;
      active_providers: number;
      pending_events: number;
    }>(
      `SELECT
        COUNT(*)::int AS request_count,
        COALESCE(SUM((SELECT SUM(value::int) FROM jsonb_each_text(detection_counts))), 0)::int AS token_count,
        COALESCE(AVG(latency_ms), 0)::float AS average_latency_ms,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::float AS p95_latency_ms,
        COUNT(DISTINCT provider)::int AS active_providers,
        COUNT(*) FILTER (WHERE status = 'pending_approval')::int AS pending_events
       FROM platform_audit_events
       WHERE organization_id = $1 AND occurred_at >= NOW() - INTERVAL '24 hours'`,
      [input.organizationId],
    );
    const modules = await this.pool.query<{
      module_name: string;
      events: number;
      last_event_at: Date | null;
    }>(
      `SELECT module_name, COUNT(*)::int AS events, MAX(occurred_at) AS last_event_at
       FROM platform_audit_events
       WHERE organization_id = $1
       GROUP BY module_name
       ORDER BY module_name ASC`,
      [input.organizationId],
    );
    const timeseries = await this.pool.query<{ hour: Date; requests: number; latency_ms: number }>(
      `SELECT date_trunc('hour', occurred_at) AS hour,
              COUNT(*)::int AS requests,
              COALESCE(AVG(latency_ms), 0)::float AS latency_ms
       FROM platform_audit_events
       WHERE organization_id = $1 AND occurred_at >= NOW() - INTERVAL '12 hours'
       GROUP BY hour
       ORDER BY hour ASC`,
      [input.organizationId],
    );
    const entities = await this.pool.query<{ type: string; count: number }>(
      `SELECT entry.key AS type, SUM(entry.value::int)::int AS count
       FROM platform_audit_events, jsonb_each_text(detection_counts) AS entry
       WHERE organization_id = $1 AND occurred_at >= NOW() - INTERVAL '24 hours'
       GROUP BY entry.key
       ORDER BY count DESC
       LIMIT 8`,
      [input.organizationId],
    );
    const row = metrics.rows[0];

    return {
      requestCount: row?.request_count ?? 0,
      tokenCount: row?.token_count ?? 0,
      averageLatencyMs: row?.average_latency_ms ?? 0,
      p95LatencyMs: row?.p95_latency_ms ?? 0,
      activeProviders: row?.active_providers ?? 0,
      pendingEvents: row?.pending_events ?? 0,
      modules: modules.rows.map((module) => ({
        module: module.module_name,
        events: module.events,
        lastEventAt: module.last_event_at?.toISOString() ?? null,
        status: module.events > 0 ? ("active" as const) : ("inactive" as const),
      })),
      timeseries: timeseries.rows.map((point) => ({
        label: point.hour.toISOString(),
        requests: point.requests,
        latencyMs: point.latency_ms,
      })),
      entities: entities.rows,
    };
  }

  public async listAuditEvents(input: { organizationId: string; page: number; pageSize: number }) {
    const page = Math.max(1, input.page);
    const pageSize = Math.min(Math.max(1, input.pageSize), 100);
    const count = await this.pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM platform_audit_events
       WHERE organization_id = $1`,
      [input.organizationId],
    );
    const total = count.rows[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const result = await this.pool.query<{
      id: string;
      request_id: string | null;
      module_name: string;
      provider: string | null;
      decision: string | null;
      detection_counts: Record<string, number>;
      status: string;
      upstream_status: number | null;
      latency_ms: number | null;
      occurred_at: Date;
    }>(
      `SELECT id::text, request_id::text, module_name, provider, decision, detection_counts,
              status, upstream_status, latency_ms, occurred_at
       FROM platform_audit_events
       WHERE organization_id = $1
       ORDER BY occurred_at DESC
       LIMIT $2 OFFSET $3`,
      [input.organizationId, pageSize, (currentPage - 1) * pageSize],
    );

    return {
      events: result.rows.map((row) => ({
        id: row.id,
        requestId: row.request_id ?? row.id,
        module: row.module_name,
        provider: row.provider ?? row.module_name,
        decision: row.decision,
        status: row.status,
        detectionCounts: row.detection_counts,
        upstreamStatus: row.upstream_status,
        overheadMs: row.latency_ms ?? 0,
        createdAt: row.occurred_at.toISOString(),
      })),
      page: currentPage,
      totalPages,
      total,
    };
  }

  public async recordBrowserAuditEvent(input: {
    organizationId: string;
    action: string;
    decision: "ALLOW" | "TOKENIZE" | "BLOCK" | "REQUIRE_APPROVAL";
    status: "allowed" | "blocked" | "pending_approval" | "failed";
    detectionCounts: Record<string, number>;
    metadata: Record<string, string | number | boolean>;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO organizations (id, slug, name)
       VALUES ($1, 'browser-protect-local', 'Browser Protect Local')
       ON CONFLICT (id) DO NOTHING`,
      [input.organizationId],
    );
    await this.pool.query(
      `INSERT INTO platform_audit_events
        (organization_id, module_name, event_type, action, decision,
         detection_counts, status, metadata)
       VALUES ($1, 'browser-protect', 'browser.protection_decision', $2, $3,
               $4::jsonb, $5, $6::jsonb)`,
      [
        input.organizationId,
        input.action,
        input.decision,
        JSON.stringify(input.detectionCounts),
        input.status,
        JSON.stringify(input.metadata),
      ],
    );
  }

  public async startConnectorOAuth(input: {
    organizationId: string;
    provider: ConnectorProvider;
    clientId: string;
    redirectUri: string;
    requestedScopes?: string[];
  }): Promise<ConnectorOAuthStartResult> {
    const provider = connectorProviderSchema.parse(input.provider);
    const oauth = await createOAuthStart({
      provider,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      organizationId: input.organizationId,
      requestedScopes: input.requestedScopes,
    });
    const encryptedVerifier = encryptSecret(oauth.codeVerifier, this.connectorVaultKey);

    await this.inTransaction(async (client) => {
      await client.query(
        `INSERT INTO connector_oauth_states
           (organization_id, provider, state_hash, code_verifier_ciphertext,
            code_verifier_iv, code_verifier_auth_tag, redirect_uri, scopes, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          input.organizationId,
          provider,
          oauth.stateHash,
          encryptedVerifier.ciphertext,
          encryptedVerifier.iv,
          encryptedVerifier.authTag,
          input.redirectUri,
          oauth.scopes,
          oauth.expiresAt,
        ],
      );
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "connectors",
        eventType: "connector.oauth_started",
        metadata: { provider, scopeCount: oauth.scopes.length },
      });
    });

    return {
      provider,
      authorizationUrl: oauth.authorizationUrl,
      state: oauth.state,
      scopes: oauth.scopes,
      expiresAt: oauth.expiresAt,
    };
  }

  public async completeConnectorOAuth(input: {
    organizationId: string;
    provider: ConnectorProvider;
    state: string;
    accessToken: string;
    refreshToken?: string;
    accountLabel?: string;
    expiresAt?: string;
  }): Promise<ConnectorConnectionSummary> {
    const provider = connectorProviderSchema.parse(input.provider);
    return this.inTransaction(async (client) => {
      const stateResult = await client.query<ConnectorOAuthStateRow>(
        `SELECT id::text, provider, state_hash, scopes, expires_at
         FROM connector_oauth_states
         WHERE organization_id = $1 AND provider = $2 AND state_hash = $3
           AND consumed_at IS NULL AND expires_at > NOW()
         FOR UPDATE`,
        [input.organizationId, provider, hashState(input.state)],
      );
      const state = requiredRow(stateResult.rows[0], "Connector OAuth state does not exist.");
      if (!safeCompareStateHash(input.state, state.state_hash)) {
        throw new RepositoryNotFoundError("Connector OAuth state does not exist.");
      }
      const scopes = validateConnectorScopes(provider, state.scopes);
      const accessToken = encryptSecret(input.accessToken, this.connectorVaultKey);
      const refreshToken = input.refreshToken
        ? encryptSecret(input.refreshToken, this.connectorVaultKey)
        : null;

      await client.query(
        `UPDATE connector_oauth_states
         SET consumed_at = NOW()
         WHERE id = $1`,
        [state.id],
      );
      const connectionResult = await client.query<ConnectorConnectionRow>(
        `INSERT INTO connector_connections
           (organization_id, provider, status, scopes, account_label,
            access_token_ciphertext, access_token_iv, access_token_auth_tag,
            refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag, expires_at)
         VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id::text, organization_id::text, provider, status, scopes, account_label,
                   expires_at, created_at, updated_at, revoked_at`,
        [
          input.organizationId,
          provider,
          scopes,
          input.accountLabel ?? null,
          accessToken.ciphertext,
          accessToken.iv,
          accessToken.authTag,
          refreshToken?.ciphertext ?? null,
          refreshToken?.iv ?? null,
          refreshToken?.authTag ?? null,
          input.expiresAt ?? null,
        ],
      );
      const connection = requiredRow(
        connectionResult.rows[0],
        "Connector connection was not created.",
      );
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "connectors",
        eventType: "connector.connected",
        metadata: { provider, scopeCount: scopes.length, connectionId: connection.id },
      });
      return serializeConnectorConnection(connection);
    });
  }

  public async listConnectorConnections(input: {
    organizationId: string;
  }): Promise<ConnectorConnectionSummary[]> {
    const result = await this.pool.query<ConnectorConnectionRow>(
      `SELECT id::text, organization_id::text, provider, status, scopes, account_label,
              expires_at, created_at, updated_at, revoked_at
       FROM connector_connections
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [input.organizationId],
    );
    return result.rows.map(serializeConnectorConnection);
  }

  public async revokeConnectorConnection(input: {
    organizationId: string;
    connectionId: string;
  }): Promise<void> {
    await this.inTransaction(async (client) => {
      const result = await client.query<ConnectorConnectionRow>(
        `UPDATE connector_connections
         SET status = 'revoked',
             access_token_ciphertext = NULL,
             access_token_iv = NULL,
             access_token_auth_tag = NULL,
             refresh_token_ciphertext = NULL,
             refresh_token_iv = NULL,
             refresh_token_auth_tag = NULL,
             revoked_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $2 AND status <> 'revoked'
         RETURNING id::text, organization_id::text, provider, status, scopes, account_label,
                   expires_at, created_at, updated_at, revoked_at`,
        [input.connectionId, input.organizationId],
      );
      const connection = requiredRow(result.rows[0], "Connector connection does not exist.");
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "connectors",
        eventType: "connector.revoked",
        metadata: { provider: connection.provider, connectionId: connection.id },
      });
    });
  }

  public async listOrganizationMembers(input: {
    organizationId: string;
  }): Promise<OrganizationMemberSummary[]> {
    const result = await this.pool.query<OrganizationMemberRow>(
      `SELECT u.id::text AS user_id, u.email, u.display_name, u.disabled_at,
              om.role, om.created_at
       FROM organization_memberships om
       JOIN platform_users u ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY
         CASE om.role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           WHEN 'security_officer' THEN 3
           WHEN 'auditor' THEN 4
           WHEN 'developer' THEN 5
           ELSE 6
         END,
         u.email ASC`,
      [input.organizationId],
    );
    return result.rows.map(serializeOrganizationMember);
  }

  public async getDesktopAuthUserByEmail(input: { email: string }): Promise<DesktopAuthUser> {
    const result = await this.pool.query<
      {
        user_id: string;
        email: string;
        display_name: string | null;
        organization_id: string;
        role: OrganizationMemberSummary["role"];
        plan: BillingAccountSummary["plan"] | null;
        current_period_end: Date | string | null;
        password_hash: string | null;
        password_salt: string | null;
        password_iterations: number | null;
        idp_id: string | null;
        idp_provider: string | null;
        auth_method: string | null;
        totp_secret: string | null;
        totp_enabled_at: Date | string | null;
        totp_recovery_codes: string[] | null;
      } & QueryResultRow
    >(
      `SELECT u.id::text AS user_id, u.email, u.display_name,
              om.organization_id::text, om.role,
              ba.plan, ba.current_period_end,
              u.password_hash, u.password_salt, u.password_iterations,
              u.idp_id, u.idp_provider, u.auth_method,
              u.totp_secret, u.totp_enabled_at, u.totp_recovery_codes
       FROM platform_users u
       JOIN organization_memberships om ON om.user_id = u.id
       LEFT JOIN billing_accounts ba ON ba.organization_id = om.organization_id
       WHERE lower(u.email) = lower($1)
         AND u.disabled_at IS NULL
       ORDER BY
         CASE om.role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           WHEN 'security_officer' THEN 3
           WHEN 'developer' THEN 4
           ELSE 5
         END
       LIMIT 1`,
      [input.email],
    );
    const row = requiredRow(result.rows[0], "Desktop user does not exist.");
    return {
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      organizationId: row.organization_id,
      role: row.role,
      plan: row.plan ?? "free",
      planRenewalDate: toIso(row.current_period_end) ?? new Date().toISOString(),
      passwordHash: row.password_hash ?? "",
      passwordSalt: row.password_salt ?? "",
      passwordIterations: row.password_iterations ?? 210000,
      idpId: row.idp_id ?? null,
      idpProvider: row.idp_provider ?? null,
      authMethod: (row.auth_method ?? "password") as "password" | "sso" | "password_sso",
      totpSecret: row.totp_secret ?? null,
      totpEnabledAt: row.totp_enabled_at ? toIso(row.totp_enabled_at) : null,
      totpRecoveryCodes: row.totp_recovery_codes ?? null,
    };
  }

  public async getDesktopAuthUser(input: { userId: string }): Promise<DesktopAuthUser> {
    const result = await this.pool.query<
      {
        user_id: string;
        email: string;
        display_name: string | null;
        organization_id: string;
        role: OrganizationMemberSummary["role"];
        plan: BillingAccountSummary["plan"] | null;
        current_period_end: Date | string | null;
        password_hash: string | null;
        password_salt: string | null;
        password_iterations: number | null;
        idp_id: string | null;
        idp_provider: string | null;
        auth_method: string | null;
        totp_secret: string | null;
        totp_enabled_at: Date | string | null;
        totp_recovery_codes: string[] | null;
      } & QueryResultRow
    >(
      `SELECT u.id::text AS user_id, u.email, u.display_name,
              om.organization_id::text, om.role,
              ba.plan, ba.current_period_end,
              u.password_hash, u.password_salt, u.password_iterations,
              u.idp_id, u.idp_provider, u.auth_method,
              u.totp_secret, u.totp_enabled_at, u.totp_recovery_codes
       FROM platform_users u
       JOIN organization_memberships om ON om.user_id = u.id
       LEFT JOIN billing_accounts ba ON ba.organization_id = om.organization_id
       WHERE u.id = $1::uuid
         AND u.disabled_at IS NULL
       ORDER BY
         CASE om.role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           WHEN 'security_officer' THEN 3
           WHEN 'developer' THEN 4
           ELSE 5
         END
       LIMIT 1`,
      [input.userId],
    );
    const row = requiredRow(result.rows[0], "Desktop user does not exist.");
    return {
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      organizationId: row.organization_id,
      role: row.role,
      plan: row.plan ?? "free",
      planRenewalDate: toIso(row.current_period_end) ?? new Date().toISOString(),
      passwordHash: row.password_hash ?? "",
      passwordSalt: row.password_salt ?? "",
      passwordIterations: row.password_iterations ?? 210000,
      idpId: row.idp_id ?? null,
      idpProvider: row.idp_provider ?? null,
      authMethod: (row.auth_method ?? "password") as "password" | "sso" | "password_sso",
      totpSecret: row.totp_secret ?? null,
      totpEnabledAt: row.totp_enabled_at ? toIso(row.totp_enabled_at) : null,
      totpRecoveryCodes: row.totp_recovery_codes ?? null,
    };
  }

  public async createDesktopAuthUser(input: CreateDesktopAuthUserInput): Promise<DesktopAuthUser> {
    return this.inTransaction(async (client) => {
      const email = input.email.toLowerCase();
      const existing = await client.query<{ id: string } & QueryResultRow>(
        `SELECT id::text
         FROM platform_users
         WHERE lower(email) = lower($1)
         LIMIT 1`,
        [email],
      );
      if (existing.rows[0]) {
        throw new RepositoryConflictError("An Oclushion account already exists for this email.");
      }

      const organizationName = `${input.displayName}'s Workspace`;
      const organizationSlug = createWorkspaceSlug(input.displayName, email);
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const organizationResult = await client.query<OrganizationRow>(
        `INSERT INTO organizations (name, slug)
         VALUES ($1, $2)
         RETURNING id, name, slug, created_at`,
        [organizationName, organizationSlug],
      );
      const organization = requiredRow(
        organizationResult.rows[0],
        "Desktop organization was not created.",
      );
      const idpCols = input.idpId ? `, idp_id, idp_provider, auth_method` : "";
      const idpVals = input.idpId ? [input.idpId, input.idpProvider ?? "workos", input.authMethod ?? "sso"] : [];
      const userResult = await client.query<
        {
          id: string;
          email: string;
          display_name: string | null;
        } & QueryResultRow
      >(
        `INSERT INTO platform_users
           (email, display_name, disabled_at, password_hash, password_salt,
            password_iterations, password_updated_at${idpCols})
         VALUES ($1, $2, NULL, $3, $4, $5, NOW()${idpVals.length ? ", $6, $7, $8" : ""})
         RETURNING id::text, email, display_name`,
        [
          email,
          input.displayName,
          input.passwordHash,
          input.passwordSalt,
          input.passwordIterations,
          ...idpVals,
        ],
      );
      const user = requiredRow(userResult.rows[0], "Desktop user was not created.");
      await client.query(
        `INSERT INTO organization_memberships (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [organization.id, user.id],
      );
      await client.query(
        `INSERT INTO billing_accounts
           (organization_id, plan, status, billing_email, current_period_start, current_period_end)
         VALUES ($1, 'free', 'active', $2, $3, $4)`,
        [organization.id, email, now.toISOString(), periodEnd.toISOString()],
      );
      await this.recordAudit(client, {
        organizationId: organization.id,
        actorId: user.id,
        module: "control-plane",
        eventType: "desktop.user_registered",
        metadata: { source: "desktop-native" },
      });

      return {
        userId: user.id,
        email: user.email,
        displayName: user.display_name,
        organizationId: organization.id,
        role: "owner",
        plan: "free",
        planRenewalDate: periodEnd.toISOString(),
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
    });
  }

  public async enableMfa(input: { userId: string; totpSecret: string; recoveryCodes: string[] }): Promise<void> {
    await this.pool.query(
      `UPDATE platform_users
       SET totp_secret = $1, totp_enabled_at = NOW(), totp_recovery_codes = $2
       WHERE id = $3::uuid`,
      [input.totpSecret, input.recoveryCodes, input.userId],
    );
  }

  public async disableMfa(input: { userId: string }): Promise<void> {
    await this.pool.query(
      `UPDATE platform_users
       SET totp_secret = NULL, totp_enabled_at = NULL, totp_recovery_codes = NULL
       WHERE id = $1::uuid`,
      [input.userId],
    );
  }

  public async consumeMfaRecoveryCode(input: { userId: string; codeIndex: number }): Promise<void> {
    await this.pool.query(
      `UPDATE platform_users
       SET totp_recovery_codes = array_remove(totp_recovery_codes, totp_recovery_codes[$2])
       WHERE id = $1::uuid`,
      [input.userId, input.codeIndex + 1],
    );
  }

  public async recordDesktopAuditEvents(input: {
    organizationId: string;
    actorId: string;
    events: Array<{
      type: string;
      summary: string;
      metadata: Record<string, string | number | boolean | null>;
      timestamp: string;
    }>;
  }): Promise<void> {
    if (!input.events.length) {
      return;
    }
    await this.inTransaction(async (client) => {
      for (const event of input.events) {
        await client.query(
          `INSERT INTO platform_audit_events
             (organization_id, actor_id, module_name, event_type, status,
              detection_counts, metadata, occurred_at)
           VALUES ($1, $2, 'agent-protect', $3, 'allowed',
                   '{}'::jsonb, $4::jsonb, $5)`,
          [
            input.organizationId,
            input.actorId,
            `desktop.${event.type.toLowerCase()}`,
            {
              summary: event.summary,
              source: "oclushion-desktop",
              ...event.metadata,
            },
            event.timestamp,
          ],
        );
      }
    });
  }

  public async listOrganizations(): Promise<Array<{
    id: string;
    slug: string;
    name: string;
    plan: string;
    auditRetentionDays: number;
  }>> {
    const result = await this.pool.query<{
      id: string;
      slug: string;
      name: string;
      plan: string;
      audit_retention_days: number;
    }>(`SELECT id, slug, name, plan, audit_retention_days FROM organizations`);
    return result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      plan: row.plan,
      auditRetentionDays: row.audit_retention_days,
    }));
  }

  public async deleteAuditEventsOlderThan(input: {
    organizationId: string;
    cutoffDate: Date;
  }): Promise<void> {
    await this.pool.query(
      `DELETE FROM platform_audit_events
       WHERE organization_id = $1 AND occurred_at < $2`,
      [input.organizationId, input.cutoffDate],
    );
  }

  public async exportAuditEvents(input: {
    organizationId: string;
    from?: Date;
    to?: Date;
  }): Promise<Array<{
    id: string;
    eventType: string;
    status: string;
    decision: string | null;
    actorId: string | null;
    occurredAt: string;
    summary: string;
    metadata: Record<string, unknown>;
  }>> {
    const conditions = ["organization_id = $1"];
    const params: unknown[] = [input.organizationId];

    if (input.from) {
      conditions.push(`occurred_at >= $${params.length + 1}`);
      params.push(input.from);
    }
    if (input.to) {
      conditions.push(`occurred_at <= $${params.length + 1}`);
      params.push(input.to);
    }

    const result = await this.pool.query<{
      id: string;
      event_type: string;
      status: string;
      decision: string | null;
      actor_id: string | null;
      occurred_at: Date;
      metadata: Record<string, unknown>;
    }>(
      `SELECT id, event_type, status, decision, actor_id, occurred_at, metadata
       FROM platform_audit_events
       WHERE ${conditions.join(" AND ")}
       ORDER BY occurred_at DESC
       LIMIT 10000`,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      status: row.status,
      decision: row.decision,
      actorId: row.actor_id,
      occurredAt: row.occurred_at.toISOString(),
      summary: String((row.metadata as Record<string, unknown>)?.summary ?? ""),
      metadata: row.metadata as Record<string, unknown>,
    }));
  }

  public async upsertAuditWebhook(input: {
    organizationId: string;
    url: string;
    secret: string;
    eventTypes: string[];
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_webhooks (organization_id, url, secret, event_types)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id) DO UPDATE SET
         url = EXCLUDED.url,
         secret = EXCLUDED.secret,
         event_types = EXCLUDED.event_types`,
      [input.organizationId, input.url, input.secret, JSON.stringify(input.eventTypes)],
    );
  }

  public async getSSOConnectionByDomain(input: {
    domain: string;
  }): Promise<{
    id: string;
    organizationId: string;
    provider: string;
    domain: string;
    idpMetadata: Record<string, unknown> | null;
    clientId: string | null;
    enabled: boolean;
    roleMappings: Array<{ idpGroup: string; oclushionRole: string }>;
  } | null> {
    const result = await this.pool.query<{
      id: string;
      organization_id: string;
      provider: string;
      domain: string;
      idp_metadata: Record<string, unknown> | null;
      client_id: string | null;
      enabled: boolean;
      role_mappings: Array<{ idpGroup: string; oclushionRole: string }>;
    }>(
      `SELECT id::text, organization_id::text, provider, domain, idp_metadata, client_id, enabled, role_mappings
       FROM sso_connections
       WHERE domain = $1 AND enabled = true
       LIMIT 1`,
      [input.domain],
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      organizationId: row.organization_id,
      provider: row.provider,
      domain: row.domain,
      idpMetadata: row.idp_metadata,
      clientId: row.client_id,
      enabled: row.enabled,
      roleMappings: row.role_mappings ?? [],
    };
  }

  public async listSSOConnections(input: {
    organizationId: string;
  }): Promise<Array<{
    id: string;
    provider: string;
    domain: string;
    enabled: boolean;
    createdAt: string;
  }>> {
    const result = await this.pool.query<{
      id: string;
      provider: string;
      domain: string;
      enabled: boolean;
      created_at: Date;
    }>(
      `SELECT id::text, provider, domain, enabled, created_at
       FROM sso_connections
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [input.organizationId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      domain: row.domain,
      enabled: row.enabled,
      createdAt: row.created_at.toISOString(),
    }));
  }

  public async upsertSSOConnection(input: {
    organizationId: string;
    provider: string;
    domain: string;
    idpMetadata?: Record<string, unknown>;
    clientId?: string;
    clientSecret?: string;
    roleMappings?: Array<{ idpGroup: string; oclushionRole: string }>;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO sso_connections (organization_id, provider, domain, idp_metadata, client_id, client_secret, role_mappings)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (organization_id, domain) DO UPDATE SET
         provider = EXCLUDED.provider,
         idp_metadata = EXCLUDED.idp_metadata,
         client_id = EXCLUDED.client_id,
         client_secret = EXCLUDED.client_secret,
         role_mappings = EXCLUDED.role_mappings,
         updated_at = NOW()`,
      [
        input.organizationId,
        input.provider,
        input.domain,
        input.idpMetadata ?? null,
        input.clientId ?? null,
        input.clientSecret ?? null,
        JSON.stringify(input.roleMappings ?? []),
      ],
    );
  }

  public async deleteSSOConnection(input: {
    organizationId: string;
    connectionId: string;
  }): Promise<void> {
    await this.pool.query(
      `DELETE FROM sso_connections
       WHERE id = $1 AND organization_id = $2`,
      [input.connectionId, input.organizationId],
    );
  }

  public async upsertOrganizationMember(input: {
    organizationId: string;
    email: string;
    role: OrganizationMemberSummary["role"];
    displayName?: string;
  }): Promise<OrganizationMemberSummary> {
    return this.inTransaction(async (client) => {
      const user = await client.query<{ id: string } & QueryResultRow>(
        `INSERT INTO platform_users (email, display_name, disabled_at)
         VALUES ($1, $2, NULL)
         ON CONFLICT (email)
         DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, platform_users.display_name),
                       disabled_at = NULL
         RETURNING id::text`,
        [input.email.toLowerCase(), input.displayName ?? null],
      );
      const userId = requiredRow(user.rows[0], "Organization member was not created.").id;
      await client.query(
        `INSERT INTO organization_memberships (organization_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [input.organizationId, userId, input.role],
      );
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "control-plane",
        eventType: "identity.member_upserted",
        metadata: { role: input.role },
      });
      const result = await client.query<OrganizationMemberRow>(
        `SELECT u.id::text AS user_id, u.email, u.display_name, u.disabled_at,
                om.role, om.created_at
         FROM organization_memberships om
         JOIN platform_users u ON u.id = om.user_id
         WHERE om.organization_id = $1 AND om.user_id = $2`,
        [input.organizationId, userId],
      );
      return serializeOrganizationMember(
        requiredRow(result.rows[0], "Organization member does not exist."),
      );
    });
  }

  public async disableOrganizationMember(input: {
    organizationId: string;
    userId: string;
  }): Promise<void> {
    await this.inTransaction(async (client) => {
      const owners = await client.query<{ owner_count: number } & QueryResultRow>(
        `SELECT COUNT(*)::int AS owner_count
         FROM organization_memberships om
         JOIN platform_users u ON u.id = om.user_id
         WHERE om.organization_id = $1 AND om.role = 'owner'
           AND u.disabled_at IS NULL AND om.user_id <> $2`,
        [input.organizationId, input.userId],
      );
      const membership = await client.query<{ role: string } & QueryResultRow>(
        `SELECT role
         FROM organization_memberships
         WHERE organization_id = $1 AND user_id = $2`,
        [input.organizationId, input.userId],
      );
      const role = requiredRow(membership.rows[0], "Organization member does not exist.").role;
      if (role === "owner" && (owners.rows[0]?.owner_count ?? 0) < 1) {
        throw new RepositoryNotFoundError("At least one active owner is required.");
      }
      await client.query(
        `UPDATE platform_users
         SET disabled_at = NOW()
         WHERE id = $1`,
        [input.userId],
      );
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "control-plane",
        eventType: "identity.member_disabled",
      });
    });
  }

  public async removeOrganizationMember(input: {
    organizationId: string;
    email: string;
  }): Promise<void> {
    await this.pool.query(
      `DELETE FROM organization_memberships om
       USING platform_users u
       WHERE om.user_id = u.id
         AND om.organization_id = $1
         AND lower(u.email) = lower($2)`,
      [input.organizationId, input.email],
    );
  }

  public async upsertBillingAccount(input: {
    organizationId: string;
    plan: BillingAccountSummary["plan"];
    status: BillingAccountSummary["status"];
    billingEmail: string;
    externalCustomerId?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
  }): Promise<BillingAccountSummary> {
    return this.inTransaction(async (client) => {
      const now = new Date();
      const periodStart = input.currentPeriodStart ?? now.toISOString();
      const periodEnd =
        input.currentPeriodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = await client.query<BillingAccountRow>(
        `INSERT INTO billing_accounts
           (organization_id, plan, status, billing_email, external_customer_id,
            current_period_start, current_period_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (organization_id)
         DO UPDATE SET plan = EXCLUDED.plan,
                       status = EXCLUDED.status,
                       billing_email = EXCLUDED.billing_email,
                       external_customer_id = EXCLUDED.external_customer_id,
                       current_period_start = EXCLUDED.current_period_start,
                       current_period_end = EXCLUDED.current_period_end,
                       updated_at = NOW()
         RETURNING organization_id::text, plan, status, billing_email, external_customer_id,
                   current_period_start, current_period_end, updated_at`,
        [
          input.organizationId,
          input.plan,
          input.status,
          input.billingEmail.toLowerCase(),
          input.externalCustomerId ?? null,
          periodStart,
          periodEnd,
        ],
      );
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "control-plane",
        eventType: "billing.account_upserted",
        metadata: { plan: input.plan, status: input.status },
      });
      return serializeBillingAccount(
        requiredRow(result.rows[0], "Billing account was not upserted."),
      );
    });
  }

  public async getBillingAccount(input: { organizationId: string }): Promise<BillingAccountSummary> {
    const result = await this.pool.query<BillingAccountRow>(
      `SELECT organization_id::text, plan, status, billing_email, external_customer_id,
              current_period_start, current_period_end, updated_at
       FROM billing_accounts
       WHERE organization_id = $1`,
      [input.organizationId],
    );
    return serializeBillingAccount(requiredRow(result.rows[0], "Billing account does not exist."));
  }

  public async recordUsageEvent(input: {
    organizationId: string;
    module: PolicyTargetModule;
    eventName: string;
    quantity: number;
    idempotencyKey: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<UsageMeterEvent> {
    return this.inTransaction(async (client) => {
      const result = await client.query<UsageMeterRow>(
        `INSERT INTO usage_meter_events
           (organization_id, module_name, event_name, quantity, idempotency_key, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (organization_id, idempotency_key)
         DO UPDATE SET idempotency_key = usage_meter_events.idempotency_key
         RETURNING id::text, organization_id::text, module_name, event_name, quantity, occurred_at`,
        [
          input.organizationId,
          input.module,
          input.eventName,
          input.quantity,
          input.idempotencyKey,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      await this.recordAudit(client, {
        organizationId: input.organizationId,
        module: "control-plane",
        eventType: "billing.usage_recorded",
        metadata: { module: input.module, eventName: input.eventName, quantity: input.quantity },
      });
      return serializeUsageEvent(requiredRow(result.rows[0], "Usage event was not recorded."));
    });
  }

  public async getUsageSummary(input: { organizationId: string }): Promise<UsageSummary> {
    const billing = await this.getBillingAccount(input);
    const result = await this.pool.query<{ module_name: string; quantity: number } & QueryResultRow>(
      `SELECT module_name, COALESCE(SUM(quantity), 0)::int AS quantity
       FROM usage_meter_events
       WHERE organization_id = $1
         AND occurred_at >= $2
         AND occurred_at < $3
       GROUP BY module_name
       ORDER BY module_name ASC`,
      [input.organizationId, billing.currentPeriodStart, billing.currentPeriodEnd],
    );
    const byModule = result.rows.map((row) => ({
      module: row.module_name,
      quantity: row.quantity,
    }));
    return {
      organizationId: input.organizationId,
      periodStart: billing.currentPeriodStart,
      periodEnd: billing.currentPeriodEnd,
      totalQuantity: byModule.reduce((total, row) => total + row.quantity, 0),
      byModule,
    };
  }

  public async debitCredits(input: {
    organizationId: string;
    userId?: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    idempotencyKey: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<CreditLedgerEntry> {
    const calculation = calculateCreditsForTokens({
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    });

    return this.inTransaction(async (client) => {
      await this.assertSpendCapForClient(client, input.organizationId, calculation.credits);
      const inserted = await client.query<CreditLedgerRow>(
        `INSERT INTO credit_ledger_entries
           (organization_id, user_id, entry_type, provider, model, input_tokens, output_tokens,
            total_tokens, credits_delta, idempotency_key, metadata)
         VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         ON CONFLICT (organization_id, idempotency_key) DO NOTHING
         RETURNING id::text, organization_id::text, user_id::text, entry_type, provider, model,
                   input_tokens, output_tokens, total_tokens, credits_delta, idempotency_key,
                   occurred_at`,
        [
          input.organizationId,
          input.userId ?? null,
          input.provider,
          input.model,
          input.inputTokens,
          input.outputTokens,
          calculation.totalTokens,
          -calculation.credits,
          input.idempotencyKey,
          JSON.stringify(input.metadata ?? {}),
        ],
      );

      const row =
        inserted.rows[0] ??
        requiredRow(
          (
            await client.query<CreditLedgerRow>(
              `SELECT id::text, organization_id::text, user_id::text, entry_type, provider, model,
                      input_tokens, output_tokens, total_tokens, credits_delta, idempotency_key,
                      occurred_at
               FROM credit_ledger_entries
               WHERE organization_id = $1 AND idempotency_key = $2`,
              [input.organizationId, input.idempotencyKey],
            )
          ).rows[0],
          "Credit ledger entry does not exist.",
        );

      const balance = await this.getCreditBalanceForClient(client, input.organizationId);

      if (inserted.rowCount === 1) {
        await this.incrementDailySpendForClient(client, input.organizationId, calculation.credits);
        await this.recordAudit(client, {
          organizationId: input.organizationId,
          actorId: input.userId,
          module: "control-plane",
          eventType: "billing.credits_debited",
          metadata: {
            provider: input.provider,
            model: input.model,
            totalTokens: calculation.totalTokens,
            credits: calculation.credits,
          },
        });
      }

      return serializeCreditLedgerEntry(row, balance);
    });
  }

  public async grantCredits(input: {
    organizationId: string;
    userId?: string;
    credits: number;
    provider: string;
    idempotencyKey: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<CreditLedgerEntry> {
    if (!Number.isInteger(input.credits) || input.credits <= 0) {
      throw new Error("Credit grants must be a positive integer.");
    }
    return this.inTransaction(async (client) => {
      const inserted = await client.query<CreditLedgerRow>(
        `INSERT INTO credit_ledger_entries
           (organization_id, user_id, entry_type, provider, model, input_tokens, output_tokens,
            total_tokens, credits_delta, idempotency_key, metadata)
         VALUES ($1, $2, 'grant', $3, 'oclushion-credit-pack', 0, 0, 0, $4, $5, $6::jsonb)
         ON CONFLICT (organization_id, idempotency_key) DO NOTHING
         RETURNING id::text, organization_id::text, user_id::text, entry_type, provider, model,
                   input_tokens, output_tokens, total_tokens, credits_delta, idempotency_key,
                   occurred_at`,
        [
          input.organizationId,
          input.userId ?? null,
          input.provider,
          input.credits,
          input.idempotencyKey,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      const row =
        inserted.rows[0] ??
        requiredRow(
          (
            await client.query<CreditLedgerRow>(
              `SELECT id::text, organization_id::text, user_id::text, entry_type, provider, model,
                      input_tokens, output_tokens, total_tokens, credits_delta, idempotency_key,
                      occurred_at
               FROM credit_ledger_entries
               WHERE organization_id = $1 AND idempotency_key = $2`,
              [input.organizationId, input.idempotencyKey],
            )
          ).rows[0],
          "Credit ledger grant entry does not exist.",
        );
      const balance = await this.getCreditBalanceForClient(client, input.organizationId);
      if (inserted.rowCount === 1) {
        await this.recordAudit(client, {
          organizationId: input.organizationId,
          actorId: input.userId,
          module: "control-plane",
          eventType: "billing.credits_granted",
          metadata: { provider: input.provider, credits: input.credits },
        });
      }
      return serializeCreditLedgerEntry(row, balance);
    });
  }

  public async getCreditBalance(input: { organizationId: string }): Promise<CreditBalanceSummary> {
    const balance = await this.getCreditBalanceForPool(input.organizationId);
    return {
      organizationId: input.organizationId,
      balance,
    };
  }

  public async getSpendCap(input: { organizationId: string }): Promise<SpendCapSummary> {
    const result = await this.pool.query<
      {
        organization_id: string;
        daily_spend_limit: number;
        current_daily_spend: number;
        daily_spend_date: string | Date;
      } & QueryResultRow
    >(
      `UPDATE organizations
       SET current_daily_spend = CASE WHEN daily_spend_date < CURRENT_DATE THEN 0 ELSE current_daily_spend END,
           daily_spend_date = CURRENT_DATE
       WHERE id = $1
       RETURNING id::text AS organization_id, daily_spend_limit, current_daily_spend, daily_spend_date`,
      [input.organizationId],
    );
    return serializeSpendCap(requiredRow(result.rows[0], "Organization spend cap does not exist."));
  }

  public async updateSpendCap(input: {
    organizationId: string;
    dailySpendLimit: number;
  }): Promise<SpendCapSummary> {
    const result = await this.pool.query<
      {
        organization_id: string;
        daily_spend_limit: number;
        current_daily_spend: number;
        daily_spend_date: string | Date;
      } & QueryResultRow
    >(
      `UPDATE organizations
       SET daily_spend_limit = $2,
           current_daily_spend = CASE WHEN daily_spend_date < CURRENT_DATE THEN 0 ELSE current_daily_spend END,
           daily_spend_date = CURRENT_DATE
       WHERE id = $1
       RETURNING id::text AS organization_id, daily_spend_limit, current_daily_spend, daily_spend_date`,
      [input.organizationId, input.dailySpendLimit],
    );
    return serializeSpendCap(requiredRow(result.rows[0], "Organization spend cap does not exist."));
  }

  public async getLaunchReadiness(input: { organizationId: string }): Promise<LaunchReadiness> {
    const [members, billing, policies, keys, audit] = await Promise.all([
      this.pool.query<{ owners: number } & QueryResultRow>(
        `SELECT COUNT(*)::int AS owners
         FROM organization_memberships om
         JOIN platform_users u ON u.id = om.user_id
         WHERE om.organization_id = $1 AND om.role = 'owner' AND u.disabled_at IS NULL`,
        [input.organizationId],
      ),
      this.pool.query<{ status: string } & QueryResultRow>(
        `SELECT status FROM billing_accounts WHERE organization_id = $1`,
        [input.organizationId],
      ),
      this.pool.query<{ policies: number } & QueryResultRow>(
        `SELECT COUNT(*)::int AS policies
         FROM policy_bindings pb
         JOIN policy_versions pv ON pv.policy_set_id = pb.policy_set_id
           AND pv.organization_id = pb.organization_id
           AND pv.status = 'published'
         WHERE pb.organization_id = $1`,
        [input.organizationId],
      ),
      this.pool.query<{ active_keys: number } & QueryResultRow>(
        `SELECT COUNT(*)::int AS active_keys
         FROM client_api_keys
         WHERE organization_id = $1 AND revoked_at IS NULL`,
        [input.organizationId],
      ),
      this.pool.query<{ audit_events: number } & QueryResultRow>(
        `SELECT COUNT(*)::int AS audit_events
         FROM platform_audit_events
         WHERE organization_id = $1`,
        [input.organizationId],
      ),
    ]);
    const checks = [
      {
        id: "identity-owner",
        label: "Identity tiene al menos un owner activo",
        passed: (members.rows[0]?.owners ?? 0) > 0,
        detail: `${members.rows[0]?.owners ?? 0} owner(s) activo(s)`,
      },
      {
        id: "billing-active",
        label: "Billing configurado para el tenant",
        passed: ["trialing", "active"].includes(billing.rows[0]?.status ?? ""),
        detail: billing.rows[0]?.status ?? "sin billing account",
      },
      {
        id: "policies-published",
        label: "Politicas publicadas y bindeadas",
        passed: (policies.rows[0]?.policies ?? 0) > 0,
        detail: `${policies.rows[0]?.policies ?? 0} binding(s) publicado(s)`,
      },
      {
        id: "gateway-key",
        label: "API keys revocables disponibles",
        passed: (keys.rows[0]?.active_keys ?? 0) > 0,
        detail: `${keys.rows[0]?.active_keys ?? 0} key(s) activa(s)`,
      },
      {
        id: "audit-durable",
        label: "Auditoria durable recibiendo eventos",
        passed: (audit.rows[0]?.audit_events ?? 0) > 0,
        detail: `${audit.rows[0]?.audit_events ?? 0} evento(s)`,
      },
      {
        id: "telemetry",
        label: "Sentry/telemetria configurada",
        passed: Boolean(process.env.SENTRY_DSN),
        detail: process.env.SENTRY_DSN ? "SENTRY_DSN presente" : "SENTRY_DSN no configurado",
      },
      {
        id: "connector-vault",
        label: "Vault de conectores configurado",
        passed: Boolean(process.env.CONNECTOR_VAULT_ENCRYPTION_KEY ?? process.env.TOKEN_MAPPING_ENCRYPTION_KEY),
        detail: "clave de cifrado disponible",
      },
    ];
    return {
      organizationId: input.organizationId,
      productionReady: checks.every((check) => check.passed),
      checks,
    };
  }

  private async requirePolicy(
    client: PoolClient,
    organizationId: string,
    policyId: string,
  ): Promise<PolicySetRow> {
    const result = await client.query<PolicySetRow>(
      `SELECT id, organization_id, name, module_name, created_at
       FROM policy_sets
       WHERE id = $1 AND organization_id = $2
       FOR UPDATE`,
      [policyId, organizationId],
    );
    return requiredRow(result.rows[0], "Policy set does not exist.");
  }

  private async recordAudit(
    client: PoolClient,
    event: {
      organizationId: string;
      actorId?: string;
      module: string;
      eventType: string;
      policyId?: string;
      policyVersionId?: string;
      metadata?: Record<string, string | number | boolean>;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO platform_audit_events
         (organization_id, actor_id, module_name, event_type, policy_id,
          policy_version_id, detection_counts, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, 'allowed', $7::jsonb)`,
      [
        event.organizationId,
        event.actorId ?? null,
        event.module,
        event.eventType,
        event.policyId ?? null,
        event.policyVersionId ?? null,
        JSON.stringify(event.metadata ?? {}),
      ],
    );
  }

  private async inTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async getCreditBalanceForClient(
    client: PoolClient,
    organizationId: string,
  ): Promise<number> {
    const result = await client.query<{ balance: number } & QueryResultRow>(
      `SELECT COALESCE(SUM(credits_delta), 0)::int AS balance
       FROM credit_ledger_entries
       WHERE organization_id = $1`,
      [organizationId],
    );
    return result.rows[0]?.balance ?? 0;
  }

  private async getCreditBalanceForPool(organizationId: string): Promise<number> {
    const result = await this.pool.query<{ balance: number } & QueryResultRow>(
      `SELECT COALESCE(SUM(credits_delta), 0)::int AS balance
       FROM credit_ledger_entries
       WHERE organization_id = $1`,
      [organizationId],
    );
    return result.rows[0]?.balance ?? 0;
  }

  private async assertSpendCapForClient(
    client: PoolClient,
    organizationId: string,
    estimatedCredits: number,
  ): Promise<void> {
    if (estimatedCredits <= 0) {
      return;
    }
    const result = await client.query<
      {
        daily_spend_limit: number;
        current_daily_spend: number;
      } & QueryResultRow
    >(
      `UPDATE organizations
       SET current_daily_spend = CASE WHEN daily_spend_date < CURRENT_DATE THEN 0 ELSE current_daily_spend END,
           daily_spend_date = CURRENT_DATE
       WHERE id = $1
       RETURNING daily_spend_limit, current_daily_spend`,
      [organizationId],
    );
    const row = requiredRow(result.rows[0], "Organization spend cap does not exist.");
    if (row.current_daily_spend + estimatedCredits > row.daily_spend_limit) {
      throw new SpendLimitReachedError(
        `Spend limit reached. Estimated ${estimatedCredits} credits would exceed the daily limit of ${row.daily_spend_limit}.`,
      );
    }
  }

  private async incrementDailySpendForClient(
    client: PoolClient,
    organizationId: string,
    credits: number,
  ): Promise<void> {
    if (credits <= 0) {
      return;
    }
    await client.query(
      `UPDATE organizations
       SET current_daily_spend = current_daily_spend + $2,
           daily_spend_date = CURRENT_DATE
       WHERE id = $1`,
      [organizationId, credits],
    );
  }

  public async validateScimToken(input: { tokenHash: string }): Promise<{
    id: string;
    organization_id: string;
    token_hash: string;
    token_prefix: string;
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
  } | null> {
    const result = await this.pool.query<{
      id: string;
      organization_id: string;
      token_hash: string;
      token_prefix: string;
      last_used_at: Date | null;
      expires_at: Date | null;
      revoked_at: Date | null;
    }>(
      `SELECT id::text, organization_id::text, token_hash, token_prefix, last_used_at, expires_at, revoked_at
       FROM scim_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())`,
      [input.tokenHash],
    );
    const row = result.rows[0] ?? null;
    if (!row) return null;
    return {
      id: row.id,
      organization_id: row.organization_id,
      token_hash: row.token_hash,
      token_prefix: row.token_prefix,
      last_used_at: row.last_used_at?.toISOString() ?? null,
      expires_at: row.expires_at?.toISOString() ?? null,
      revoked_at: row.revoked_at?.toISOString() ?? null,
    };
  }

  public async touchScimToken(input: { tokenHash: string }): Promise<void> {
    await this.pool.query(
      `UPDATE scim_tokens SET last_used_at = now() WHERE token_hash = $1`,
      [input.tokenHash],
    );
  }

  public async createScimToken(input: {
    organizationId: string;
    tokenHash: string;
    tokenPrefix: string;
    name: string;
    description?: string;
    expiresAt?: string;
  }): Promise<{ id: string }> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO scim_tokens (organization_id, token_hash, token_prefix, name, description, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id::text`,
      [input.organizationId, input.tokenHash, input.tokenPrefix, input.name, input.description ?? null, input.expiresAt ?? null],
    );
    return { id: result.rows[0]?.id ?? "" };
  }

  public async listScimTokens(input: {
    organizationId: string;
  }): Promise<Array<{
    id: string;
    token_prefix: string;
    name: string;
    description: string | null;
    last_used_at: string | null;
    created_at: string;
    expires_at: string | null;
    revoked_at: string | null;
  }>> {
    const result = await this.pool.query<{
      id: string;
      token_prefix: string;
      name: string;
      description: string | null;
      last_used_at: Date | null;
      created_at: Date;
      expires_at: Date | null;
      revoked_at: Date | null;
    }>(
      `SELECT id::text, token_prefix, name, description, last_used_at, created_at, expires_at, revoked_at
       FROM scim_tokens
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [input.organizationId],
    );
    return result.rows.map((r) => ({
      id: r.id,
      token_prefix: r.token_prefix,
      name: r.name,
      description: r.description,
      last_used_at: r.last_used_at?.toISOString() ?? null,
      created_at: r.created_at.toISOString(),
      expires_at: r.expires_at?.toISOString() ?? null,
      revoked_at: r.revoked_at?.toISOString() ?? null,
    }));
  }

  public async revokeScimToken(input: {
    organizationId: string;
    tokenId: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE scim_tokens SET revoked_at = now() WHERE id::text = $1 AND organization_id::text = $2`,
      [input.tokenId, input.organizationId],
    );
  }

  public async createInvitation(input: {
    organizationId: string;
    email: string;
    role: string;
    invitedBy: string;
  }): Promise<{
    id: string;
    invitationCode: string;
    expiresAt: string;
  }> {
    const result = await this.pool.query<{
      id: string;
      invitation_code: string;
      expires_at: Date;
    }>(
      `INSERT INTO organization_invitations (organization_id, email, role, invited_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, invitation_code, expires_at`,
      [input.organizationId, input.email.toLowerCase(), input.role, input.invitedBy],
    );
    const row = requiredRow(result.rows[0], "Invitation was not created.");
    return { id: row.id, invitationCode: row.invitation_code, expiresAt: row.expires_at.toISOString() };
  }

  public async validateInvitation(input: {
    code: string;
  }): Promise<{
    id: string;
    organizationId: string;
    email: string;
    role: string;
  } | null> {
    const result = await this.pool.query<{
      id: string;
      organization_id: string;
      email: string;
      role: string;
    }>(
      `UPDATE organization_invitations
       SET status = 'accepted', accepted_at = NOW()
       WHERE invitation_code = $1
         AND status = 'pending'
         AND expires_at > NOW()
       RETURNING id::text, organization_id::text, email, role`,
      [input.code],
    );
    return result.rows[0]
      ? {
          id: result.rows[0].id,
          organizationId: result.rows[0].organization_id,
          email: result.rows[0].email,
          role: result.rows[0].role,
        }
      : null;
  }

  public async markInvitationAccepted(input: {
    id: string;
    acceptedBy: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE organization_invitations
       SET accepted_by = $1
       WHERE id = $2`,
      [input.acceptedBy, input.id],
    );
  }

  public async createPairingCode(input: {
    organizationId: string;
    createdBy: string;
  }): Promise<{
    id: string;
    code: string;
    expiresAt: string;
  }> {
    const result = await this.pool.query<{
      id: string;
      code: string;
      expires_at: Date;
    }>(
      `INSERT INTO pairing_codes (organization_id, created_by)
       VALUES ($1, $2)
       RETURNING id::text, code, expires_at`,
      [input.organizationId, input.createdBy],
    );
    const row = requiredRow(result.rows[0], "Pairing code was not created.");
    return { id: row.id, code: row.code, expiresAt: row.expires_at.toISOString() };
  }

  public async validatePairingCode(input: {
    code: string;
  }): Promise<{
    id: string;
    organizationId: string;
  } | null> {
    const result = await this.pool.query<{ id: string; organization_id: string }>(
      `UPDATE pairing_codes
       SET status = 'used', used_count = used_count + 1, used_at = NOW()
       WHERE code = $1
         AND status = 'active'
         AND expires_at > NOW()
         AND used_count < max_uses
       RETURNING id::text, organization_id::text`,
      [input.code],
    );
    return result.rows[0]
      ? { id: result.rows[0].id, organizationId: result.rows[0].organization_id }
      : null;
  }

  public async startTrial(input: {
    organizationId: string;
    durationDays?: number;
    maxMembers?: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO trial_settings (organization_id, trial_ends_at, trial_max_members)
       VALUES ($1, NOW() + ($2 || ' days')::interval, $3)
       ON CONFLICT (organization_id) DO UPDATE SET
         trial_ends_at = EXCLUDED.trial_ends_at,
         status = 'trialing',
         updated_at = NOW()`,
      [input.organizationId, String(input.durationDays ?? 14), input.maxMembers ?? 5],
    );
  }

  public async getTrialStatus(input: {
    organizationId: string;
  }): Promise<{
    active: boolean;
    expired?: boolean;
    daysLeft?: number;
    message?: string;
  }> {
    const result = await this.pool.query<{
      status: string;
      trial_ends_at: Date;
      trial_max_members: number;
    }>(
      `SELECT status, trial_ends_at, trial_max_members
       FROM trial_settings
       WHERE organization_id = $1`,
      [input.organizationId],
    );
    if (!result.rows[0] || result.rows[0].status !== "trialing") {
      return { active: false };
    }
    const now = new Date();
    const endsAt = result.rows[0].trial_ends_at;
    if (endsAt <= now) {
      await this.pool.query(
        `UPDATE trial_settings SET status = 'expired', updated_at = NOW()
         WHERE organization_id = $1 AND status = 'trialing'`,
        [input.organizationId],
      );
      return { active: false, expired: true, message: "Your trial has ended." };
    }
    const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      active: true,
      daysLeft,
      message: daysLeft <= 3
        ? `Your trial ends in ${daysLeft} days. Upgrade now to keep your team.`
        : `${daysLeft} days left in your trial.`,
    };
  }

  public async convertTrialToPaid(input: {
    organizationId: string;
    plan: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE trial_settings
       SET status = 'converted', upgraded_at = NOW(), upgraded_plan = $2, updated_at = NOW()
       WHERE organization_id = $1`,
      [input.organizationId, input.plan],
    );
  }

  public async listExpiringTrials(input: {
    withinDays: number;
  }): Promise<Array<{
    organizationId: string;
    organizationName: string;
    trialEndsAt: string;
  }>> {
    const result = await this.pool.query<{
      organization_id: string;
      org_name: string;
      trial_ends_at: Date;
    }>(
      `SELECT ts.organization_id, o.name AS org_name, ts.trial_ends_at
       FROM trial_settings ts
       JOIN organizations o ON o.id = ts.organization_id
       WHERE ts.status = 'trialing'
         AND ts.trial_ends_at > NOW()
         AND ts.trial_ends_at <= NOW() + ($1 || ' days')::interval
         AND (ts.reminder_sent_at IS NULL OR ts.reminder_sent_at < NOW() - interval '1 day')`,
      [String(input.withinDays)],
    );
    return result.rows.map((row) => ({
      organizationId: row.organization_id,
      organizationName: row.org_name,
      trialEndsAt: row.trial_ends_at.toISOString(),
    }));
  }
}

function requiredRow<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new RepositoryNotFoundError(message);
  }
  return row;
}

function serializeOrganization(row: OrganizationRow): CreatedOrganization {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.created_at.toISOString(),
  };
}

function serializeConnectorConnection(row: ConnectorConnectionRow): ConnectorConnectionSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    provider: row.provider,
    status: row.status,
    scopes: row.scopes,
    accountLabel: row.account_label,
    expiresAt: row.expires_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString() ?? null,
  };
}

function serializeOrganizationMember(row: OrganizationMemberRow): OrganizationMemberSummary {
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    disabledAt: row.disabled_at?.toISOString() ?? null,
  };
}

function serializeBillingAccount(row: BillingAccountRow): BillingAccountSummary {
  return {
    organizationId: row.organization_id,
    plan: row.plan,
    status: row.status,
    billingEmail: row.billing_email,
    externalCustomerId: row.external_customer_id,
    currentPeriodStart: row.current_period_start.toISOString(),
    currentPeriodEnd: row.current_period_end.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function serializeUsageEvent(row: UsageMeterRow): UsageMeterEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    module: row.module_name,
    eventName: row.event_name,
    quantity: row.quantity,
    occurredAt: row.occurred_at.toISOString(),
  };
}

function serializeCreditLedgerEntry(row: CreditLedgerRow, balanceAfter: number): CreditLedgerEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    type: row.entry_type,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    creditsDelta: row.credits_delta,
    balanceAfter,
    idempotencyKey: row.idempotency_key,
    occurredAt: row.occurred_at.toISOString(),
  };
}

function serializeSpendCap(row: {
  organization_id: string;
  daily_spend_limit: number;
  current_daily_spend: number;
  daily_spend_date: Date | string;
}): SpendCapSummary {
  return {
    organizationId: row.organization_id,
    dailySpendLimit: row.daily_spend_limit,
    currentDailySpend: row.current_daily_spend,
    dailySpendDate:
      row.daily_spend_date instanceof Date
        ? row.daily_spend_date.toISOString().slice(0, 10)
        : String(row.daily_spend_date),
  };
}

function createWorkspaceSlug(displayName: string, email: string): string {
  const base = (displayName || email.split("@")[0] || "workspace")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48);
  return `${base || "workspace"}-${randomUUID().slice(0, 8)}`;
}

function toIso(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function readConnectorVaultKey(): string {
  return (
    process.env.CONNECTOR_VAULT_ENCRYPTION_KEY ??
    process.env.TOKEN_MAPPING_ENCRYPTION_KEY ??
    "oclushion-local-connector-vault-development-key"
  );
}
