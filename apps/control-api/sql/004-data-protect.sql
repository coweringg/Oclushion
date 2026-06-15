CREATE TABLE IF NOT EXISTS data_token_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  query_id UUID NOT NULL,
  token TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, token)
);

CREATE INDEX IF NOT EXISTS data_token_vault_query_idx
  ON data_token_vault (organization_id, query_id);
