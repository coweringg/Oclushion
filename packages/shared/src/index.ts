import { z } from "zod";

export const skillCategorySchema = z.enum([
  "architecture",
  "frontend",
  "backend",
  "security",
  "design",
  "academic",
  "code-review",
  "devops",
  "data",
  "mobile",
  "ai-ml",
  "documentation",
  "fullstack",
]);

export const marketplacePlanSchema = z.enum(["Free", "Pro", "Team", "Enterprise", "free", "pro", "enterprise"]);

export const skillAuthorSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  url: z.string().url().optional(),
});

export const skillSourceSchema = z.object({
  type: z.enum(["aitmpl", "antigravity", "academic", "ui-skills", "github", "custom"]),
  url: z.string().url(),
  license: z.string(),
});

export const skillContentSchema = z.object({
  prompts: z.array(z.string()),
  tools: z.array(z.any()),
  systemPrompt: z.string(),
});

export const skillStatsSchema = z.object({
  downloads: z.number().default(0),
  rating: z.number().min(0).max(5).default(0),
  reviews: z.number().default(0),
});

export const skillSchema = z.object({
  id: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  version: z.string(),
  category: skillCategorySchema,
  plan: marketplacePlanSchema,
  tags: z.array(z.string()),
  author: skillAuthorSchema,
  source: skillSourceSchema,
  content: skillContentSchema,
  stats: skillStatsSchema,
  dependencies: z.array(z.string().uuid()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
  verified: z.boolean().default(false),
});

export const catalogEntrySchema = z.object({
  id: z.string().min(1).max(100),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  category: z.string(),
  plan: z.string(),
  tags: z.array(z.string()),
  author: z.object({ name: z.string() }),
  stats: skillStatsSchema,
  updatedAt: z.string().datetime(),
  verified: z.boolean().default(false),
});

export const catalogSchema = z.object({
  version: z.string(),
  updated: z.string().datetime(),
  skills: z.array(catalogEntrySchema),
  skillpacks: z.array(
    z.object({
      id: z.string().min(1).max(100),
      name: z.string(),
      description: z.string(),
      skills: z.array(z.string().min(1).max(100)),
      plan: z.string(),
      verified: z.boolean().default(false),
    })
  ),
  agents: z.array(
    z.object({
      id: z.string().min(1).max(100),
      name: z.string(),
      description: z.string(),
      role: z.string(),
      model: z.string(),
      systemPrompt: z.string(),
      tools: z.array(z.string()),
      plan: z.string(),
      verified: z.boolean().default(false),
    })
  ),
  commands: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
      trigger: z.string(),
      prompt: z.string(),
      plan: z.string(),
    })
  ),
  hooks: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string(),
      trigger: z.string(),
      script: z.string(),
      plan: z.string(),
    })
  ),
});

export const sensitiveEntityTypeSchema = z.enum([
  "person",
  "email",
  "phone",
  "payment_card",
  "bank_account",
  "api_key",
  "access_token",
  "private_key",
]);

export const detectionSchema = z.object({
  type: sensitiveEntityTypeSchema,
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
});

export const analyzeTextRequestSchema = z.object({
  requestId: z.string().min(1),
  text: z.string(),
  languages: z.array(z.string().min(2)).default(["es", "en"]),
});

export const analyzeTextResponseSchema = z.object({
  requestId: z.string().min(1),
  engine: z.string().min(1),
  detections: z.array(detectionSchema),
});

export const proxyProviderSchema = z.enum(["openai", "anthropic"]);

export const serviceHealthSchema = z.object({
  service: z.string().min(1),
  status: z.literal("ok"),
  version: z.string().min(1),
});

export const organizationRoleSchema = z.enum([
  "owner",
  "admin",
  "security_officer",
  "auditor",
  "developer",
  "viewer",
]);

export const organizationSchema = z.object({
  id: z.uuid(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2).max(120),
  createdAt: z.iso.datetime(),
});

export const organizationMembershipSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  role: organizationRoleSchema,
  createdAt: z.iso.datetime(),
});

export const policyTargetModuleSchema = z.enum([
  "gateway-protect",
  "chat-protect",
  "agent-protect",
  "data-protect",
  "browser-protect",
  "connectors",
]);

export const protectionModuleSchema = z.enum([
  ...policyTargetModuleSchema.options,
  "control-plane",
]);

export const policyEffectSchema = z.enum(["ALLOW", "TOKENIZE", "BLOCK", "REQUIRE_APPROVAL"]);

export const policyConditionSchema = z.object({
  type: z.enum(["timeRange", "actorMatch", "metadataMatch"]),
  timeRange: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string().default("UTC"),
      daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    })
    .optional(),
  actorIds: z.array(z.string().min(1)).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const policyRuleSchema = z.object({
  id: z.string().min(1).max(100),
  priority: z.number().int().nonnegative().default(100),
  enabled: z.boolean().default(true),
  actions: z.array(z.string().min(1).max(100)).default([]),
  entityTypes: z.array(sensitiveEntityTypeSchema).default([]),
  effect: policyEffectSchema,
  conditions: z.array(policyConditionSchema).default([]),
});

export const gatewayBaselinePolicyRules = policyRuleSchema.array().parse([
  {
    id: "gateway-baseline-tokenize-sensitive-data",
    priority: 100,
    enabled: true,
    actions: ["provider_request"],
    entityTypes: sensitiveEntityTypeSchema.options,
    effect: "TOKENIZE",
  },
]);

export const chatBaselinePolicyRules = policyRuleSchema.array().parse([
  {
    id: "chat-baseline-tokenize-sensitive-data",
    priority: 100,
    enabled: true,
    actions: ["chat_message"],
    entityTypes: sensitiveEntityTypeSchema.options,
    effect: "TOKENIZE",
  },
]);

export const browserBaselinePolicyRules = policyRuleSchema.array().parse([
  {
    id: "browser-baseline-tokenize-sensitive-data",
    priority: 100,
    enabled: true,
    actions: ["browser_prompt_submit", "browser_paste", "browser_file_upload"],
    entityTypes: sensitiveEntityTypeSchema.options,
    effect: "TOKENIZE",
  },
]);

export const policySnapshotSchema = z.object({
  organizationId: z.uuid(),
  policyId: z.uuid(),
  policyVersionId: z.uuid(),
  version: z.number().int().positive(),
  module: policyTargetModuleSchema,
  status: z.literal("published"),
  rules: z.array(policyRuleSchema),
  publishedAt: z.iso.datetime(),
});

export const policyEvaluationContextSchema = z.object({
  organizationId: z.uuid(),
  module: policyTargetModuleSchema,
  action: z.string().min(1).max(100),
  actorId: z.string().optional(),
  apiKeyId: z.uuid().optional(),
  provider: proxyProviderSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  detections: z
    .array(
      z.object({
        type: sensitiveEntityTypeSchema,
        confidence: z.number().min(0).max(1),
      }),
    )
    .default([]),
});

export const policyDecisionSchema = z.object({
  effect: policyEffectSchema,
  matchedRuleIds: z.array(z.string().min(1)),
  tokenizeEntityTypes: z.array(sensitiveEntityTypeSchema).default([]),
  policyVersionId: z.uuid(),
  reasonCode: z.string().min(1).max(100),
  requiresMapping: z.boolean(),
});

export const gatewayPrincipalSchema = z.object({
  apiKeyId: z.uuid(),
  organizationId: z.uuid(),
  scopes: z.array(z.string().min(1).max(100)),
});

export const policyBindingSchema = z.object({
  organizationId: z.uuid(),
  module: policyTargetModuleSchema,
  policyId: z.uuid(),
  updatedAt: z.iso.datetime(),
});

const auditMetadataSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .default({})
  .superRefine((metadata, context) => {
    for (const key of Object.keys(metadata)) {
      if (/(content|payload|prompt|secret|password|token|credential|pii|raw|value)/iu.test(key)) {
        context.addIssue({
          code: "custom",
          message: `Audit metadata key "${key}" can contain sensitive content.`,
          path: [key],
        });
      }
    }
  });

export const platformAuditEventSchema = z.object({
  eventId: z.uuid(),
  organizationId: z.uuid(),
  actorId: z.uuid().optional(),
  apiKeyId: z.uuid().optional(),
  requestId: z.uuid().optional(),
  module: protectionModuleSchema,
  action: z.string().min(1).max(100),
  eventType: z.string().min(1).max(80),
  provider: proxyProviderSchema.optional(),
  upstreamStatus: z.number().int().min(100).max(599).optional(),
  decision: policyEffectSchema.optional(),
  policyId: z.uuid().optional(),
  policyVersionId: z.uuid().optional(),
  detectionCounts: z
    .partialRecord(sensitiveEntityTypeSchema, z.number().int().nonnegative())
    .default({}),
  status: z.enum(["allowed", "blocked", "pending_approval", "failed"]),
  latencyMs: z.number().nonnegative().optional(),
  occurredAt: z.iso.datetime(),
  metadata: auditMetadataSchema,
});

export type SensitiveEntityType = z.infer<typeof sensitiveEntityTypeSchema>;
export type Detection = z.infer<typeof detectionSchema>;
export type AnalyzeTextRequest = z.infer<typeof analyzeTextRequestSchema>;
export type AnalyzeTextResponse = z.infer<typeof analyzeTextResponseSchema>;
export type ProxyProvider = z.infer<typeof proxyProviderSchema>;
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationMembership = z.infer<typeof organizationMembershipSchema>;
export type PolicyCondition = z.infer<typeof policyConditionSchema>;
export type PolicyTargetModule = z.infer<typeof policyTargetModuleSchema>;
export type ProtectionModule = z.infer<typeof protectionModuleSchema>;
export type PolicyEffect = z.infer<typeof policyEffectSchema>;
export type PolicyRule = z.infer<typeof policyRuleSchema>;
export type PolicySnapshot = z.infer<typeof policySnapshotSchema>;
export type PolicyEvaluationContext = z.infer<typeof policyEvaluationContextSchema>;
export type PolicyDecision = z.infer<typeof policyDecisionSchema>;
export type GatewayPrincipal = z.infer<typeof gatewayPrincipalSchema>;
export type PolicyBinding = z.infer<typeof policyBindingSchema>;
export type PlatformAuditEvent = z.infer<typeof platformAuditEventSchema>;
