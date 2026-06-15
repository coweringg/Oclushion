CREATE TABLE IF NOT EXISTS sanitation_audit_events (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  sanitized_counts JSONB NOT NULL,
  upstream_status INTEGER NOT NULL,
  overhead_ms DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sanitation_audit_events_created_at_idx
  ON sanitation_audit_events (created_at DESC);
