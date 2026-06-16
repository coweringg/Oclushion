import { readFile, readdir } from "node:fs/promises";

import { Pool } from "pg";

import { readEnvironment } from "./config/environment.js";

const environment = readEnvironment();
const pool = new Pool({ connectionString: environment.DATABASE_URL });

try {
  const sqlDir = new URL("../sql/", import.meta.url);
  const files = (await readdir(sqlDir))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const migration = await readFile(new URL(file, sqlDir), "utf8");
    await pool.query(migration);
  }
  process.stdout.write("Control API migration applied.\n");
} finally {
  await pool.end();
}
