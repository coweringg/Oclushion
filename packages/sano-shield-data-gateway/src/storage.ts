import type { Pool } from "pg";

import type { TokenizedCell } from "@oclushion/sano-shield-data-protect";

import { encryptValue } from "./crypto.js";

export async function ensureDataOrganization(input: { pool: Pool; organizationId: string }) {
  await input.pool.query(
    `INSERT INTO organizations (id, slug, name)
     VALUES ($1, 'data-protect-local', 'Data Protect Local')
     ON CONFLICT (id) DO NOTHING`,
    [input.organizationId],
  );
}

export async function persistTokenizedCells(input: {
  pool: Pool;
  organizationId: string;
  queryId: string;
  cells: TokenizedCell[];
  key: Buffer;
}) {
  for (const cell of input.cells) {
    const encrypted = encryptValue(
      cell.original,
      `${input.organizationId}:${input.queryId}:${cell.token}`,
      input.key,
    );
    await input.pool.query(
      `INSERT INTO data_token_vault
        (organization_id, query_id, token, table_name, column_name,
         ciphertext, iv, auth_tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (organization_id, token) DO NOTHING`,
      [
        input.organizationId,
        input.queryId,
        cell.token,
        cell.table,
        cell.column,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
      ],
    );
  }
}

export async function recordDataAudit(input: {
  pool: Pool;
  organizationId: string;
  queryId: string;
  decision: "ALLOW" | "BLOCK";
  status: "allowed" | "blocked" | "failed";
  detectionCounts: Record<string, number>;
  latencyMs: number;
  metadata: Record<string, string | number | boolean>;
}) {
  await input.pool.query(
    `INSERT INTO platform_audit_events
      (organization_id, request_id, module_name, event_type, decision,
       detection_counts, status, latency_ms, metadata)
     VALUES ($1, $2, 'data-protect', 'data_query_processed', $3,
             $4::jsonb, $5, $6, $7::jsonb)`,
    [
      input.organizationId,
      input.queryId,
      input.decision,
      JSON.stringify(input.detectionCounts),
      input.status,
      input.latencyMs,
      JSON.stringify(input.metadata),
    ],
  );
}
