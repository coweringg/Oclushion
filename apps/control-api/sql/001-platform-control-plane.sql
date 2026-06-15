CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'security_officer', 'auditor', 'developer', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS policy_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  module_name TEXT NOT NULL CHECK (
    module_name IN ('gateway-protect', 'chat-protect', 'agent-protect', 'data-protect', 'browser-protect', 'connectors')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name, module_name)
);

CREATE TABLE IF NOT EXISTS policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_set_id UUID NOT NULL REFERENCES policy_sets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  rules JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE (policy_set_id, version),
  UNIQUE (id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_versions_one_published_idx
  ON policy_versions (policy_set_id)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS platform_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES platform_users(id),
  module_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  policy_id UUID REFERENCES policy_sets(id),
  policy_version_id UUID,
  decision TEXT CHECK (decision IS NULL OR decision IN ('ALLOW', 'TOKENIZE', 'BLOCK', 'REQUIRE_APPROVAL')),
  detection_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('allowed', 'blocked', 'pending_approval', 'failed')),
  latency_ms DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (policy_version_id, organization_id)
    REFERENCES policy_versions(id, organization_id)
);

CREATE INDEX IF NOT EXISTS platform_audit_events_org_time_idx
  ON platform_audit_events (organization_id, occurred_at DESC);
