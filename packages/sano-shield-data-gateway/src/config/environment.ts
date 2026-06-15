import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATA_GATEWAY_HOST: z.string().default("127.0.0.1"),
  DATA_GATEWAY_PORT: z.coerce.number().int().positive().max(65535).default(8083),
  DATA_GATEWAY_TOKEN: z.string().min(32),
  DATABASE_URL: z.string().url(),
  DATA_SOURCE_DATABASE_URL: z.string().url().optional(),
  DATA_PROTECT_ENCRYPTION_KEY: z.string().min(1),
  DATA_PROTECT_POLICIES_JSON: z.string().optional(),
  DATA_GATEWAY_ENABLE_RATE_LIMITING: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  DATA_GATEWAY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
});

export type DataGatewayEnvironment = z.infer<typeof environmentSchema>;

export function readEnvironment(source: NodeJS.ProcessEnv = process.env): DataGatewayEnvironment {
  return environmentSchema.parse(source);
}
