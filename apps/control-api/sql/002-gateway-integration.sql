CREATE TABLE IF NOT EXISTS client_api_keys (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS client_api_keys_organization_idx
  ON client_api_keys (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS policy_bindings (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL CHECK (
    module_name IN ('gateway-protect', 'chat-protect', 'agent-protect', 'data-protect', 'browser-protect', 'connectors')
  ),
  policy_set_id UUID NOT NULL REFERENCES policy_sets(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, module_name)
);

ALTER TABLE platform_audit_events
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES client_api_keys(id),
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS upstream_status INTEGER;

CREATE INDEX IF NOT EXISTS platform_audit_events_request_idx
  ON platform_audit_events (request_id)
  WHERE request_id IS NOT NULL;
