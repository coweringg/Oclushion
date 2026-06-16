import { Pool } from "pg";

import { createApp } from "./app.js";
import { readEnvironment } from "./config/environment.js";
import { PostgresControlRepository } from "./storage/repository.js";

const environment = readEnvironment();
const pool = new Pool({
  connectionString: environment.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  max: 10,
  idleTimeoutMillis: 30000,
});
pool.on("error", (err) => console.error("[db] Pool error:", err.message));
const repository = new PostgresControlRepository(pool);
const app = await createApp(repository, {
  adminToken: environment.CONTROL_API_ADMIN_TOKEN,
  internalToken: environment.CONTROL_API_INTERNAL_TOKEN,
  enableRateLimiting: environment.CONTROL_API_ENABLE_RATE_LIMITING,
  rateLimitMax: environment.CONTROL_API_RATE_LIMIT_MAX,
  allowedOrigins: environment.CONTROL_API_ALLOWED_ORIGINS,
});

app.addHook("onClose", async () => pool.end());

try {
  await app.listen({ host: environment.CONTROL_API_HOST, port: environment.CONTROL_API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
