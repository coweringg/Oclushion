import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";

import {
  ConnectorScopeError,
  connectorProviderSchema,
  listConnectorCatalog,
} from "@oclushion/connectors";
import { policyRuleSchema, policyTargetModuleSchema } from "@oclushion/shared";

import { requirePermission } from "../auth/rbac.middleware.js";
import type { ControlRepository } from "../storage/repository.js";
import { RepositoryNotFoundError, SpendLimitReachedError } from "../storage/repository.js";
import { s, uuidParam, paginationQuery } from "./schema-helpers.js";

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ownerEmail: z.email(),
});

const organizationParamsSchema = z.object({ organizationId: z.uuid() });
const dashboardQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
});
const browserAuditSchema = z.object({
  organizationId: z.uuid(),
  module: z.literal("browser-protect"),
  action: z.enum(["browser_prompt_submit", "browser_paste", "browser_file_upload"]),
  eventType: z.literal("browser.protection_decision"),
  decision: z.enum(["ALLOW", "TOKENIZE", "BLOCK", "REQUIRE_APPROVAL"]),
  status: z.enum(["allowed", "blocked", "pending_approval", "failed"]),
  detectionCounts: z.record(z.string(), z.number().int().nonnegative()).default({}),
  metadata: z.object({
    host: z.string().max(255),
    selector: z.string().max(255),
    promptLength: z.number().int().nonnegative(),
  }),
});
const policyParamsSchema = z.object({
  organizationId: z.uuid(),
  policyId: z.uuid(),
});
const policyVersionParamsSchema = policyParamsSchema.extend({ policyVersionId: z.uuid() });
const gatewayKeyParamsSchema = organizationParamsSchema.extend({ apiKeyId: z.uuid() });
const moduleParamsSchema = organizationParamsSchema.extend({ module: policyTargetModuleSchema });
const connectorParamsSchema = organizationParamsSchema.extend({
  provider: connectorProviderSchema,
});
const connectorConnectionParamsSchema = organizationParamsSchema.extend({
  connectionId: z.uuid(),
});
const memberParamsSchema = organizationParamsSchema.extend({ userId: z.uuid() });

const createPolicySchema = z.object({
  name: z.string().min(2).max(120),
  module: policyTargetModuleSchema,
});
const createVersionSchema = z.object({
  rules: z.array(policyRuleSchema).min(1),
});
const createGatewayApiKeySchema = z.object({
  name: z.string().min(2).max(120),
  scopes: z.array(z.string().min(1).max(100)).min(1).default(["proxy:invoke"]),
});
const rotateGatewayApiKeySchema = z.object({});
const listExpiringApiKeysSchema = z.object({
  withinDays: z.coerce.number().int().min(1).max(30).default(7),
});
const bindPolicySchema = z.object({ policyId: z.uuid() });
const upsertModulePolicySchema = z.object({
  name: z.string().min(2).max(120),
  rules: z.array(policyRuleSchema).min(1),
});
const connectorOAuthStartSchema = z.object({
  clientId: z.string().min(2).max(200),
  redirectUri: z.string().url(),
  scopes: z.array(z.string().min(1).max(200)).default([]),
});
const connectorOAuthCompleteSchema = z.object({
  state: z.string().min(16).max(200),
  accessToken: z.string().min(8).max(4096),
  refreshToken: z.string().min(8).max(4096).optional(),
  accountLabel: z.string().min(1).max(200).optional(),
  expiresAt: z.string().datetime().optional(),
});
const upsertMemberSchema = z.object({
  email: z.email(),
  displayName: z.string().min(1).max(120).optional(),
  role: z.enum(["owner", "admin", "security_officer", "auditor", "developer", "viewer"]),
});
const billingAccountSchema = z.object({
  plan: z.enum(["free", "pro", "team", "enterprise"]),
  status: z.enum(["trialing", "active", "past_due", "canceled"]),
  billingEmail: z.email(),
  externalCustomerId: z.string().min(1).max(200).optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
});
const usageEventSchema = z.object({
  module: policyTargetModuleSchema,
  eventName: z.string().min(2).max(120).regex(/^[a-z0-9_.:-]+$/),
  quantity: z.number().int().positive().max(1_000_000),
  idempotencyKey: z.string().min(8).max(200),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});
const creditDebitSchema = z.object({
  userId: z.uuid().optional(),
  provider: z.string().min(2).max(80),
  model: z.string().min(1).max(120),
  inputTokens: z.number().int().nonnegative().max(10_000_000),
  outputTokens: z.number().int().nonnegative().max(10_000_000),
  idempotencyKey: z.string().min(8).max(200),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});
const controlRoutes: FastifyPluginAsync<{ repository: ControlRepository }> = async (
  app,
  options,
) => {
  app.post("/v1/organizations", {
    schema: s(["Organizations"], "Create a new organization", "createOrganization"),
  }, async (request, reply) => {
    const body = createOrganizationSchema.parse(request.body);
    const organization = await options.repository.createOrganization(body);
    return reply.code(201).send(organization);
  });

  app.put("/v1/organizations/:organizationId", {
    schema: s(["Organizations"], "Create or update organization", "ensureOrganization", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    const body = createOrganizationSchema.parse(request.body);
    return options.repository.ensureOrganization({ ...params, ...body });
  });

  app.post("/v1/organizations/:organizationId/policies", {
    schema: s(["Policies"], "Create a policy set", "createPolicySet", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request, reply) => {
    const params = organizationParamsSchema.parse(request.params);
    const body = createPolicySchema.parse(request.body);
    const policy = await options.repository.createPolicySet({ ...params, ...body });
    return reply.code(201).send(policy);
  });

  app.post("/v1/organizations/:organizationId/policies/:policyId/versions", {
    schema: s(["Policies"], "Create a new policy version", "createPolicyVersion", {
      params: {
        type: "object", required: ["organizationId", "policyId"],
        properties: { organizationId: uuidParam, policyId: uuidParam },
      },
    }),
  }, async (request, reply) => {
    const params = policyParamsSchema.parse(request.params);
    const body = createVersionSchema.parse(request.body);
    const version = await options.repository.createPolicyVersion({ ...params, ...body });
    return reply.code(201).send(version);
  });

  app.post("/v1/organizations/:organizationId/policies/:policyId/versions/:policyVersionId/publish", {
    schema: s(["Policies"], "Publish a policy version", "publishPolicyVersion", {
      params: {
        type: "object", required: ["organizationId", "policyId", "policyVersionId"],
        properties: { organizationId: uuidParam, policyId: uuidParam, policyVersionId: uuidParam },
      },
    }),
  }, async (request) => {
    const params = policyVersionParamsSchema.parse(request.params);
    return options.repository.publishPolicyVersion(params);
  });

  app.get("/v1/organizations/:organizationId/policies/:policyId/snapshot", {
    schema: s(["Policies"], "Get published policy snapshot", "getPublishedSnapshot", {
      params: {
        type: "object", required: ["organizationId", "policyId"],
        properties: { organizationId: uuidParam, policyId: uuidParam },
      },
    }),
  }, async (request) => {
    const params = policyParamsSchema.parse(request.params);
    return options.repository.getPublishedSnapshot(params);
  });

  app.post("/v1/organizations/:organizationId/gateway-api-keys", {
    schema: s(["Gateway"], "Create a gateway API key", "createGatewayApiKey", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request, reply) => {
    const params = organizationParamsSchema.parse(request.params);
    const body = createGatewayApiKeySchema.parse(request.body);
    const apiKey = await options.repository.createGatewayApiKey({
      ...params,
      ...body,
      createdBy: "control-api-admin",
    });
    return reply.code(201).send(apiKey);
  });

  app.get("/v1/organizations/:organizationId/gateway-api-keys", {
    schema: s(["Gateway"], "List gateway API keys", "listGatewayApiKeys", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    return options.repository.listGatewayApiKeys(params);
  });

  app.delete("/v1/organizations/:organizationId/gateway-api-keys/:apiKeyId", {
    schema: s(["Gateway"], "Revoke a gateway API key", "revokeGatewayApiKey", {
      params: {
        type: "object", required: ["organizationId", "apiKeyId"],
        properties: { organizationId: uuidParam, apiKeyId: uuidParam },
      },
    }),
  }, async (request, reply) => {
    const params = gatewayKeyParamsSchema.parse(request.params);
    await options.repository.revokeGatewayApiKey(params);
    return reply.code(204).send();
  });

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(request as unknown as Record<string, unknown>).session) {
      return reply.code(401).send({ error: "Valid Oclushion session required." });
    }
  };

  app.post("/v1/organizations/:organizationId/gateway-api-keys/:apiKeyId/rotate", {
    preHandler: [requireAuth, requirePermission("gateway:admin")],
    schema: s(["Gateway"], "Rotate a gateway API key", "rotateGatewayApiKey", {
      params: {
        type: "object", required: ["organizationId", "apiKeyId"],
        properties: { organizationId: uuidParam, apiKeyId: uuidParam },
      },
    }),
  }, async (request, reply) => {
    const params = gatewayKeyParamsSchema.parse(request.params);
    rotateGatewayApiKeySchema.parse(request.body ?? {});
    const rotated = await options.repository.rotateGatewayApiKey(params);
    return reply.code(201).send(rotated);
  });

  app.get("/v1/gateway-api-keys/expiring", {
    preHandler: [requireAuth, requirePermission("gateway:admin")],
    schema: s(["Gateway"], "List API keys expiring soon", "listExpiringApiKeys"),
  }, async (request) => {
    const { withinDays } = listExpiringApiKeysSchema.parse(request.query);
    return options.repository.listExpiringApiKeys({ withinDays });
  });

  app.put("/v1/organizations/:organizationId/modules/:module/policy-binding", {
    schema: s(["Policies"], "Bind a policy to a module", "bindModulePolicy", {
      params: {
        type: "object", required: ["organizationId", "module"],
        properties: { organizationId: uuidParam, module: { type: "string" } },
      },
    }),
  }, async (request) => {
    const params = moduleParamsSchema.parse(request.params);
    const body = bindPolicySchema.parse(request.body);
    await options.repository.bindModulePolicy({ ...params, ...body });
    return { status: "bound", ...params, ...body };
  });

  app.get("/v1/organizations/:organizationId/modules/:module/policy-binding/snapshot", {
    schema: s(["Policies"], "Get bound published snapshot for module", "getBoundPublishedSnapshot", {
      params: {
        type: "object", required: ["organizationId", "module"],
        properties: { organizationId: uuidParam, module: { type: "string" } },
      },
    }),
  }, async (request) => {
    const params = moduleParamsSchema.parse(request.params);
    return options.repository.getBoundPublishedSnapshot(params);
  });

  app.put("/v1/organizations/:organizationId/modules/:module/policy", {
    schema: s(["Policies"], "Upsert a module policy with rules", "upsertModulePolicy", {
      params: {
        type: "object", required: ["organizationId", "module"],
        properties: { organizationId: uuidParam, module: { type: "string" } },
      },
    }),
  }, async (request) => {
    const params = moduleParamsSchema.parse(request.params);
    const body = upsertModulePolicySchema.parse(request.body);
    return options.repository.upsertModulePolicy({ ...params, ...body });
  });

  app.get("/v1/organizations/:organizationId/dashboard/overview", {
    schema: s(["Organizations"], "Get dashboard overview for organization", "getDashboardOverview", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    return options.repository.getDashboardOverview(params);
  });

  app.get("/v1/organizations/:organizationId/audit-events", {
    schema: s(["Audit"], "List audit events for organization", "listAuditEvents", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
      querystring: paginationQuery,
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    const query = dashboardQuerySchema.parse(request.query);
    return options.repository.listAuditEvents({ ...params, ...query });
  });

  app.get("/v1/organizations/:organizationId/members", {
    schema: s(["Organizations"], "List organization members", "listOrganizationMembers", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    return options.repository.listOrganizationMembers(params);
  });

  app.put("/v1/organizations/:organizationId/members", {
    schema: s(["Organizations"], "Create or update organization member", "upsertOrganizationMember", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    const body = upsertMemberSchema.parse(request.body);
    return options.repository.upsertOrganizationMember({ ...params, ...body });
  });

  app.delete("/v1/organizations/:organizationId/members/:userId", {
    schema: s(["Organizations"], "Disable organization member", "disableOrganizationMember", {
      params: {
        type: "object", required: ["organizationId", "userId"],
        properties: { organizationId: uuidParam, userId: uuidParam },
      },
    }),
  }, async (request, reply) => {
    const params = memberParamsSchema.parse(request.params);
    await options.repository.disableOrganizationMember(params);
    return reply.code(204).send();
  });

  app.get("/v1/organizations/:organizationId/billing", {
    schema: s(["Billing"], "Get billing account", "getBillingAccount", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    return options.repository.getBillingAccount(params);
  });

  app.put("/v1/organizations/:organizationId/billing", {
    schema: s(["Billing"], "Create or update billing account", "upsertBillingAccount", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    const body = billingAccountSchema.parse(request.body);
    return options.repository.upsertBillingAccount({ ...params, ...body });
  });

  app.post("/v1/organizations/:organizationId/usage-events", {
    schema: s(["Usage"], "Record a usage event", "recordUsageEvent", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request, reply) => {
    const params = organizationParamsSchema.parse(request.params);
    const body = usageEventSchema.parse(request.body);
    const event = await options.repository.recordUsageEvent({ ...params, ...body });
    return reply.code(201).send(event);
  });

  app.get("/v1/organizations/:organizationId/usage", {
    schema: s(["Usage"], "Get usage summary", "getUsageSummary", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    return options.repository.getUsageSummary(params);
  });

  app.post("/v1/organizations/:organizationId/credits/debit", {
    schema: s(["Usage"], "Debit credits for LLM usage", "debitCredits", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request, reply) => {
    const params = organizationParamsSchema.parse(request.params);
    const body = creditDebitSchema.parse(request.body);
    try {
      const entry = await options.repository.debitCredits({ ...params, ...body });
      return reply.code(201).send(entry);
    } catch (error) {
      if (error instanceof SpendLimitReachedError) {
        return reply.code(429).send({ error: "Spend limit reached", message: error.message });
      }
      throw error;
    }
  });

  app.get("/v1/organizations/:organizationId/credits/balance", {
    schema: s(["Usage"], "Get credit balance", "getCreditBalance", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    return options.repository.getCreditBalance(params);
  });

  app.get("/v1/organizations/:organizationId/launch-readiness", {
    schema: s(["Organizations"], "Get launch readiness status", "getLaunchReadiness", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    return options.repository.getLaunchReadiness(params);
  });

  app.get("/v1/connectors/catalog", {
    schema: s(["Connectors"], "List available connector providers", "listConnectorCatalog"),
  }, async () =>
    listConnectorCatalog().map((entry) => ({
      id: entry.id,
      name: entry.name,
      priority: entry.priority,
      enabled: entry.enabled,
      defaultScopes: entry.defaultScopes,
      allowedScopes: entry.allowedScopes,
      resourceTypes: entry.resourceTypes,
      hasRevocation: Boolean(entry.revocationUrl),
    })),
  );

  app.post("/v1/organizations/:organizationId/connectors/:provider/oauth/start", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: s(["Connectors"], "Start OAuth flow for connector", "startConnectorOAuth", {
      params: {
        type: "object", required: ["organizationId", "provider"],
        properties: { organizationId: uuidParam, provider: { type: "string" } },
      },
    }),
  }, async (request, reply) => {
    const params = connectorParamsSchema.parse(request.params);
    const body = connectorOAuthStartSchema.parse(request.body);
    const start = await options.repository.startConnectorOAuth({
      ...params,
      clientId: body.clientId,
      redirectUri: body.redirectUri,
      requestedScopes: body.scopes,
    });
    return reply.code(201).send(start);
  });

  app.post("/v1/organizations/:organizationId/connectors/:provider/oauth/complete", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: s(["Connectors"], "Complete OAuth flow for connector", "completeConnectorOAuth", {
      params: {
        type: "object", required: ["organizationId", "provider"],
        properties: { organizationId: uuidParam, provider: { type: "string" } },
      },
    }),
  }, async (request, reply) => {
    const params = connectorParamsSchema.parse(request.params);
    const body = connectorOAuthCompleteSchema.parse(request.body);
    const connection = await options.repository.completeConnectorOAuth({ ...params, ...body });
    return reply.code(201).send(connection);
  });

  app.get("/v1/organizations/:organizationId/connectors", {
    schema: s(["Connectors"], "List connector connections", "listConnectorConnections", {
      params: { type: "object", required: ["organizationId"], properties: { organizationId: uuidParam } },
    }),
  }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    return options.repository.listConnectorConnections(params);
  });

  app.delete("/v1/organizations/:organizationId/connectors/:connectionId", {
    schema: s(["Connectors"], "Revoke a connector connection", "revokeConnectorConnection", {
      params: {
        type: "object", required: ["organizationId", "connectionId"],
        properties: { organizationId: uuidParam, connectionId: uuidParam },
      },
    }),
  }, async (request, reply) => {
    const params = connectorConnectionParamsSchema.parse(request.params);
    await options.repository.revokeConnectorConnection(params);
    return reply.code(204).send();
  });

  app.post("/v1/browser/audit-events", {
    schema: s(["Audit"], "Record browser protection audit event", "recordBrowserAuditEvent"),
  }, async (request, reply) => {
    const body = browserAuditSchema.parse(request.body);
    await options.repository.recordBrowserAuditEvent(body);
    return reply.code(202).send({ status: "accepted" });
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: "Invalid control API request.", issues: error.issues });
    }
    if (error instanceof RepositoryNotFoundError) {
      return reply.code(404).send({ error: error.message });
    }
    if (error instanceof ConnectorScopeError) {
      return reply.code(400).send({ error: error.message });
    }
    throw error;
  });
};

export default controlRoutes;
