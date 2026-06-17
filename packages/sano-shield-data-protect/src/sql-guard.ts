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
  if (trimmed.length > 20_000) {
    throw new SqlRejectedError("SQL query exceeds maximum length.");
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
    /^select\s+([\w.*"`,()]+(?:\s+[\w.*"`,()]+)*)\s+from\s+([a-zA-Z_][\w."]*)((?:\s+(?:where|join|left|right|inner|cross|outer|group|having|order|limit|offset)[\s\S]*)?)$/iu,
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

function extractAlias(column: string): string | null {
  const trimmed = column.trimEnd();
  const asIdx = trimmed.toLowerCase().lastIndexOf(" as ");
  if (asIdx < 0) return null;
  const alias = trimmed.slice(asIdx + 4).trim();
  if (!alias || alias.length > 128) return null;
  for (let i = 0; i < alias.length; i++) {
    const ch = alias.charCodeAt(i);
    if (!((ch >= 97 && ch <= 122) || (ch >= 65 && ch <= 90) || ch === 95 || ch === 34 || (ch >= 48 && ch <= 57))) {
      return null;
    }
  }
  return alias;
}

function parseProjectedColumns(segment: string) {
  return segment
    .split(",")
    .map((column) => column.trim())
    .map((column) => {
      const alias = extractAlias(column);
      if (alias) {
        return alias.replaceAll('"', "").toLowerCase();
      }
      const parts = column.split(".");
      return (parts.at(-1) ?? column).replaceAll('"', "").toLowerCase();
    });
}

function extractLimit(sql: string) {
  const match = sql.match(/\blimit\s+(\d+)\b/iu);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}
