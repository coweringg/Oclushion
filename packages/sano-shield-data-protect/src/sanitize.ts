import { createHash } from "node:crypto";

import { findTablePolicy } from "./policy.js";
import type { DataProtectionPolicy, SanitizedResult, TokenizedCell } from "./types.js";

export function sanitizeRows(input: {
  table: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  policy: DataProtectionPolicy;
}): SanitizedResult {
  const tablePolicy = findTablePolicy(input.policy, input.table);
  if (!tablePolicy) {
    return { columns: input.columns, rows: input.rows, counts: {}, tokenizedCells: [] };
  }

  const counts: Record<string, number> = {};
  const tokenizedCells: TokenizedCell[] = [];
  const outputColumns = input.columns.filter(
    (column) => tablePolicy.columns[column.toLowerCase()]?.action !== "BLOCK",
  );
  const rows = input.rows.map((row) => {
    const sanitized: Record<string, unknown> = {};
    for (const column of outputColumns) {
      const columnPolicy = tablePolicy.columns[column.toLowerCase()];
      const value = row[column];
      if (!columnPolicy || columnPolicy.action === "ALLOW") {
        sanitized[column] = value;
        continue;
      }
      counts[columnPolicy.semanticType ?? "generic"] = (counts[columnPolicy.semanticType ?? "generic"] ?? 0) + 1;
      if (columnPolicy.action === "MASK") {
        sanitized[column] = maskValue(value, columnPolicy.semanticType);
      } else if (columnPolicy.action === "TOKENIZE") {
        const original = String(value ?? "");
        const token = `SANO_DATA_TOKEN_${createHash("sha256").update(`${input.table}:${column}:${original}`).digest("hex").slice(0, 16)}`;
        sanitized[column] = token;
        tokenizedCells.push({ token, original, table: input.table, column });
      }
    }
    return sanitized;
  });

  for (const [column, columnPolicy] of Object.entries(tablePolicy.columns)) {
    if (columnPolicy.action === "BLOCK" && input.columns.includes(column)) {
      counts[columnPolicy.semanticType ?? "generic"] = (counts[columnPolicy.semanticType ?? "generic"] ?? 0) + input.rows.length;
    }
  }

  return { columns: outputColumns, rows, counts, tokenizedCells };
}

function maskValue(value: unknown, semanticType?: string) {
  if (value === null || value === undefined) {
    return value;
  }
  const text = String(value);
  if (semanticType === "email") {
    const [local, domain] = text.split("@");
    if (!local || !domain) {
      return "***";
    }
    return `${local[0] ?? "*"}***@${domain}`;
  }
  if (semanticType === "payment_card") {
    return `xxxx-xxxx-xxxx-${text.slice(-4)}`;
  }
  return text.length <= 2 ? "***" : `${text[0]}***${text.slice(-1)}`;
}
