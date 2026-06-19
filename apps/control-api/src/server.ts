import { createServer } from "node:net";
import { Pool } from "pg";

import { createApp } from "./app.js";
import { readEnvironment } from "./config/environment.js";
import { PostgresControlRepository } from "./storage/repository.js";

const environment = readEnvironment();

const portInUse = await isPortInUse(environment.CONTROL_API_HOST, environment.CONTROL_API_PORT);
if (portInUse) {
  console.log(
    `[control-api] Port ${environment.CONTROL_API_PORT} on ${environment.CONTROL_API_HOST} ` +
      `is already in use — skipping duplicate startup.`,
  );
  process.exit(0);
}

function isPortInUse(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err: NodeJS.ErrnoException) => resolve(err.code === "EADDRINUSE"));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port, host);
  });
}

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
