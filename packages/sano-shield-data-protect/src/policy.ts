import type { DataProtectionPolicy, DataTablePolicy } from "./types.js";

export const defaultDataProtectionPolicy: DataProtectionPolicy = {
  defaultMaxRows: 100,
  tables: [
    {
      table: "employees",
      maxRows: 100,
      columns: {
        email: { action: "MASK", semanticType: "email" },
        salary: { action: "BLOCK", semanticType: "generic" },
        ssn: { action: "BLOCK", semanticType: "generic" },
        credit_card: { action: "TOKENIZE", semanticType: "payment_card" },
      },
    },
    {
      table: "customers",
      maxRows: 100,
      columns: {
        email: { action: "MASK", semanticType: "email" },
        ssn: { action: "BLOCK", semanticType: "generic" },
        credit_card: { action: "TOKENIZE", semanticType: "payment_card" },
      },
    },
  ],
};

export function parseDataProtectionPolicy(source?: string): DataProtectionPolicy {
  if (!source) {
    return defaultDataProtectionPolicy;
  }
  const parsed = JSON.parse(source) as DataProtectionPolicy;
  return {
    defaultMaxRows: parsed.defaultMaxRows || defaultDataProtectionPolicy.defaultMaxRows,
    tables: parsed.tables ?? [],
  };
}

export function findTablePolicy(
  policy: DataProtectionPolicy,
  table: string,
): DataTablePolicy | undefined {
  const normalized = normalizeTableName(table);
  return policy.tables.find((entry) => normalizeTableName(entry.table) === normalized);
}

export function normalizeTableName(table: string) {
  return table.replaceAll('"', "").toLowerCase();
}
