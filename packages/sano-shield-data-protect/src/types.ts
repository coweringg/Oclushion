export type DataColumnAction = "ALLOW" | "MASK" | "BLOCK" | "TOKENIZE";

export type DataColumnPolicy = {
  action: DataColumnAction;
  semanticType?: "email" | "payment_card" | "person" | "generic";
};

export type DataTablePolicy = {
  table: string;
  maxRows: number;
  columns: Record<string, DataColumnPolicy>;
  rowFilter?: {
    column: string;
    contextKey: string;
  };
};

export type DataProtectionPolicy = {
  defaultMaxRows: number;
  tables: DataTablePolicy[];
};

export type SqlValidationResult = {
  normalizedSql: string;
  table: string;
  projectedColumns: string[];
  limit: number;
};

export type TokenizedCell = {
  token: string;
  original: string;
  table: string;
  column: string;
};

export type SanitizedResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  counts: Record<string, number>;
  tokenizedCells: TokenizedCell[];
};
