CREATE TABLE IF NOT EXISTS dashboard_auth_events (
  id BIGSERIAL PRIMARY KEY,
  actor_email TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'logout')),
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dashboard_auth_events_created_at_idx
  ON dashboard_auth_events (created_at DESC);

CREATE TABLE IF NOT EXISTS dashboard_sessions (
  id UUID PRIMARY KEY,
  actor_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS dashboard_sessions_active_idx
  ON dashboard_sessions (expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS sanitation_policies (
  id TEXT PRIMARY KEY DEFAULT 'default',
  detect_email BOOLEAN NOT NULL DEFAULT TRUE,
  detect_phone BOOLEAN NOT NULL DEFAULT TRUE,
  detect_person BOOLEAN NOT NULL DEFAULT TRUE,
  detect_credit_card BOOLEAN NOT NULL DEFAULT TRUE,
  detect_api_key BOOLEAN NOT NULL DEFAULT TRUE,
  allowlist_domains TEXT[] NOT NULL DEFAULT '{}',
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sanitation_policies_singleton CHECK (id = 'default')
);

CREATE TABLE IF NOT EXISTS client_api_keys (
  id UUID PRIMARY KEY,
  organization_id UUID,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

ALTER TABLE client_api_keys
  ADD COLUMN IF NOT EXISTS organization_id UUID;

CREATE INDEX IF NOT EXISTS client_api_keys_created_at_idx
  ON client_api_keys (created_at DESC);

CREATE INDEX IF NOT EXISTS client_api_keys_organization_idx
  ON client_api_keys (organization_id, created_at DESC);
