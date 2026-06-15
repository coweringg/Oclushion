-- SCIM 2.0 Provisioning
-- Tokens provisionados por org para integración con IdP (Okta, Entra, Google)

CREATE TABLE IF NOT EXISTS scim_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,
    token_prefix    TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT 'default',
    description     TEXT,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_scim_tokens_org ON scim_tokens(organization_id);
CREATE INDEX idx_scim_tokens_hash ON scim_tokens(token_hash);

COMMENT ON TABLE scim_tokens IS 'SCIM 2.0 bearer tokens for automatic user provisioning from identity providers';
COMMENT ON COLUMN scim_tokens.token_hash IS 'SHA-256 hash of the SCIM bearer token';
COMMENT ON COLUMN scim_tokens.token_prefix IS 'First 8 chars of the token for identification';
COMMENT ON COLUMN scim_tokens.expires_at IS 'Token expiration; NULL means never expires';
COMMENT ON COLUMN scim_tokens.revoked_at IS 'If set, token is revoked and cannot be used';

-- SCIM group role mappings
CREATE TABLE IF NOT EXISTS scim_role_mappings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scim_group      TEXT NOT NULL,
    oclushion_role  TEXT NOT NULL CHECK (oclushion_role IN ('owner','admin','security_officer','auditor','developer','viewer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_scim_role_mappings_org_group ON scim_role_mappings(organization_id, scim_group);

COMMENT ON TABLE scim_role_mappings IS 'Maps SCIM groups from IdP to Oclushion roles';
