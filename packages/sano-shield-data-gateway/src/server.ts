import { Pool } from "pg";

import { createApp } from "./app.js";
import { readEnvironment } from "./config/environment.js";

const environment = readEnvironment();
const sourcePool = new Pool({
  connectionString: environment.DATA_SOURCE_DATABASE_URL ?? environment.DATABASE_URL,
  max: 5,
});
const controlPool = new Pool({ connectionString: environment.DATABASE_URL, max: 3 });
const app = createApp({ environment, sourcePool, controlPool });

const shutdown = async () => {
  await app.close();
  await Promise.all([sourcePool.end(), controlPool.end()]);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: environment.DATA_GATEWAY_HOST, port: environment.DATA_GATEWAY_PORT });
