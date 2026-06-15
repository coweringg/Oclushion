import { readFile } from "node:fs/promises";

import { Pool } from "pg";

import { readEnvironment } from "./config/environment.js";

const environment = readEnvironment();
const pool = new Pool({ connectionString: environment.DATABASE_URL });

try {
  for (const file of [
    "001-platform-control-plane.sql",
    "002-gateway-integration.sql",
    "003-chat-protect.sql",
    "004-data-protect.sql",
    "005-connectors.sql",
    "006-launch-readiness.sql",
    "007-oclushion-plans-credits.sql",
    "008-oclushion-production-integration.sql",
    "009-billing-spend-caps-stripe.sql",
    "010-audit-retention.sql",
    "011-audit-webhooks.sql",
    "012-sso-connections.sql",
    "013-org-invitations-pairing.sql",
    "014-scim-provisioning.sql",
    "015-secrets-rotation.sql",
    "016-jobs-tracking.sql",
  ]) {
    const migration = await readFile(new URL(`../sql/${file}`, import.meta.url), "utf8");
    await pool.query(migration);
  }
  process.stdout.write("Control API migration applied.\n");
} finally {
  await pool.end();
}
