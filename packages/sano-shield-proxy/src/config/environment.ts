import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PII_SERVICE_URL: z.string().url(),
  CONTROL_API_URL: z.string().url().default("http://127.0.0.1:8082"),
  CONTROL_API_INTERNAL_TOKEN: z.string().min(32),
  PROXY_POLICY_ORGANIZATION_IDS: z.string().default(""),
  POLICY_SNAPSHOT_REFRESH_MS: z.coerce.number().int().positive().default(30000),
  POLICY_SNAPSHOT_MAX_AGE_MS: z.coerce.number().int().positive().default(120000),
  TOKEN_MAPPING_ENCRYPTION_KEY: z.string().min(1),
  TOKEN_MAPPING_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  PROXY_HOST: z.string().default("0.0.0.0"),
  PROXY_PORT: z.coerce.number().int().positive().max(65535).default(8080),
  PROXY_ALLOWED_UPSTREAM_HOSTS: z.string().min(1),
  OPENAI_UPSTREAM_BASE_URL: z.string().url().default("https://api.openai.com"),
  ANTHROPIC_UPSTREAM_BASE_URL: z.string().url().default("https://api.anthropic.com"),
  ENABLE_AUDIT_LOG: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  ENABLE_RATE_LIMITING: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  PROXY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  PROXY_MAX_BODY_BYTES: z.coerce.number().int().positive().default(1048576),
  PROXY_UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  PROXY_UPSTREAM_RETRY_MAX: z.coerce.number().int().min(0).max(5).default(2),
  PROXY_IP_DENYLIST: z.string().default(""),
  REDIS_PASSWORD: z.string().default(""),
});

export type ProxyEnvironment = z.infer<typeof environmentSchema>;

export function readEnvironment(source: NodeJS.ProcessEnv = process.env): ProxyEnvironment {
  return environmentSchema.parse(source);
}
