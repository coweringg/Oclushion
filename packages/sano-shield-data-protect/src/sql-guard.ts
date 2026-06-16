import type { DataProtectionPolicy, SqlValidationResult } from "./types.js";
import { findTablePolicy, normalizeTableName } from "./policy.js";

const dangerousPattern =
  /\b(insert|update|delete|drop|alter|truncate|create|copy|execute|grant|revoke|merge|call)\b/iu;

export class SqlRejectedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SqlRejectedError";
  }
}

export function validateSelectSql(
  sql: string,
  policy: DataProtectionPolicy,
): SqlValidationResult {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new SqlRejectedError("SQL query is empty.");
  }
  const withoutTrailingSemicolon = trimmed.endsWith(";") ? trimmed.slice(0, -1).trim() : trimmed;
  if (withoutTrailingSemicolon.includes(";")) {
    throw new SqlRejectedError("Multiple SQL statements are not allowed.");
  }
  if (!/^select\s/iu.test(withoutTrailingSemicolon)) {
    throw new SqlRejectedError("Only SELECT queries are allowed.");
  }
  if (dangerousPattern.test(withoutTrailingSemicolon) || /--|\/\*|\*\/|#/u.test(withoutTrailingSemicolon)) {
    throw new SqlRejectedError("Query contains a blocked SQL construct.");
  }

  const match = withoutTrailingSemicolon.match(
    /^select\s+([\w.*"`,()\s]+?)\s+from\s+([a-zA-Z_][\w."]*)((?:\s+(?:where|join|left|right|inner|cross|outer|group|having|order|limit|offset)[\s\S]*)?)$/iu,
  );
  if (!match?.[1] || !match[2]) {
    throw new SqlRejectedError("Only simple SELECT ... FROM queries are supported in this phase.");
  }
  const projectedColumns = parseProjectedColumns(match[1]);
  if (projectedColumns.includes("*")) {
    throw new SqlRejectedError("SELECT * is blocked; request explicit columns.");
  }

  const table = normalizeTableName(match[2]);
  const tablePolicy = findTablePolicy(policy, table);
  if (!tablePolicy) {
    throw new SqlRejectedError(`Table "${table}" is not allowed by Data Protect policy.`);
  }
  const currentLimit = extractLimit(withoutTrailingSemicolon);
  const limit = Math.min(currentLimit ?? tablePolicy.maxRows ?? policy.defaultMaxRows, tablePolicy.maxRows);
  const normalizedSql = currentLimit
    ? withoutTrailingSemicolon.replace(/\blimit\s+\d+\b/iu, `LIMIT ${limit}`)
    : `${withoutTrailingSemicolon} LIMIT ${limit}`;

  return { normalizedSql, table, projectedColumns, limit };
}

function parseProjectedColumns(segment: string) {
  return segment
    .split(",")
    .map((column) => column.trim())
    .map((column) => {
      const aliasMatch = column.match(/\s+as\s+([a-zA-Z_][\w"]*)$/iu);
      if (aliasMatch?.[1]) {
        return aliasMatch[1].replaceAll('"', "").toLowerCase();
      }
      const parts = column.split(".");
      return (parts.at(-1) ?? column).replaceAll('"', "").toLowerCase();
    });
}

function extractLimit(sql: string) {
  const match = sql.match(/\blimit\s+(\d+)\b/iu);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}
