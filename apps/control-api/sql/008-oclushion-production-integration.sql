ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_salt TEXT,
  ADD COLUMN IF NOT EXISTS password_iterations INTEGER NOT NULL DEFAULT 210000,
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS platform_users_email_active_idx
  ON platform_users (lower(email))
  WHERE disabled_at IS NULL;
