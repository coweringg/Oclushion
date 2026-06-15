import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  CONTROL_API_HOST: z.string().default("127.0.0.1"),
  CONTROL_API_PORT: z.coerce.number().int().positive().max(65535).default(8082),
  CONTROL_API_ADMIN_TOKEN: z.string().min(32),
  CONTROL_API_INTERNAL_TOKEN: z.string().min(32),
  CONTROL_API_ENABLE_RATE_LIMITING: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  CONTROL_API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  CONTROL_API_ALLOWED_ORIGINS: z.string().default("").transform((val) => {
    if (!val) return undefined;
    try { return JSON.parse(val) as string[]; } catch { return undefined; }
  }),
});

export type ControlApiEnvironment = z.infer<typeof environmentSchema>;

export function readEnvironment(source: NodeJS.ProcessEnv = process.env): ControlApiEnvironment {
  return environmentSchema.parse(source);
}
