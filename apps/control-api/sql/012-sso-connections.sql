CREATE TABLE IF NOT EXISTS sso_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('okta', 'entra_id', 'google_workspace', 'generic_oidc', 'generic_saml')),
  domain TEXT NOT NULL,
  idp_metadata JSONB,
  client_id TEXT,
  client_secret TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  role_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, domain)
);

ALTER TABLE platform_users
ADD COLUMN IF NOT EXISTS idp_id TEXT,
ADD COLUMN IF NOT EXISTS idp_provider TEXT,
ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'password' CHECK (auth_method IN ('password', 'sso', 'password_sso'));

CREATE INDEX IF NOT EXISTS idx_platform_users_idp ON platform_users(idp_provider, idp_id);

ALTER TABLE organization_memberships
ADD COLUMN IF NOT EXISTS idp_groups TEXT[];
