ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS organization_sso_configs (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('saml', 'oidc')),
  status TEXT NOT NULL CHECK (status IN ('configured', 'disabled')),
  domain TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_accounts (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'growth', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  billing_email TEXT NOT NULL,
  external_customer_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_meter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL CHECK (
    module_name IN ('gateway-protect', 'chat-protect', 'agent-protect', 'data-protect', 'browser-protect', 'connectors')
  ),
  event_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS usage_meter_events_org_time_idx
  ON usage_meter_events (organization_id, occurred_at DESC);
