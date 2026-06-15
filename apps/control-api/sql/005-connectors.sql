ALTER TABLE platform_audit_events
  ADD COLUMN IF NOT EXISTS action TEXT;

CREATE TABLE IF NOT EXISTS connector_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google-drive', 'slack', 'github', 'notion')),
  state_hash TEXT NOT NULL UNIQUE,
  code_verifier_ciphertext TEXT NOT NULL,
  code_verifier_iv TEXT NOT NULL,
  code_verifier_auth_tag TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS connector_oauth_states_org_provider_idx
  ON connector_oauth_states (organization_id, provider, expires_at DESC);

CREATE TABLE IF NOT EXISTS connector_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google-drive', 'slack', 'github', 'notion')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'revoked', 'failed')),
  scopes TEXT[] NOT NULL,
  account_label TEXT,
  access_token_ciphertext TEXT,
  access_token_iv TEXT,
  access_token_auth_tag TEXT,
  refresh_token_ciphertext TEXT,
  refresh_token_iv TEXT,
  refresh_token_auth_tag TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS connector_connections_org_provider_idx
  ON connector_connections (organization_id, provider, status);

CREATE TABLE IF NOT EXISTS connector_resource_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connector_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google-drive', 'slack', 'github', 'notion')),
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content_ciphertext TEXT NOT NULL,
  content_iv TEXT NOT NULL,
  content_auth_tag TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  detection_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, connection_id, resource_id)
);
