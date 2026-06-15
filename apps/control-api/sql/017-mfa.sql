ALTER TABLE platform_users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS totp_recovery_codes TEXT[];

CREATE INDEX IF NOT EXISTS idx_platform_users_totp_enabled
  ON platform_users (totp_enabled_at)
  WHERE totp_enabled_at IS NOT NULL;
