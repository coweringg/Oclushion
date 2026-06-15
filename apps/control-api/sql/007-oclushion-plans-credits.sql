ALTER TABLE billing_accounts
  DROP CONSTRAINT IF EXISTS billing_accounts_plan_check;

ALTER TABLE billing_accounts
  ADD CONSTRAINT billing_accounts_plan_check
  CHECK (plan IN ('free', 'pro', 'team', 'enterprise'));

CREATE TABLE IF NOT EXISTS credit_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('grant', 'debit', 'adjustment')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),
  credits_delta INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_entries_org_time
  ON credit_ledger_entries (organization_id, occurred_at DESC);
