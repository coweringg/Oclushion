-- SEC-07: Secrets rotation and expiration
-- Adds expires_at column to client_api_keys for automated rotation support.
-- Rotation policy: keys without explicit expiry get a 90-day rolling window.
-- Expired keys are rejected at validation time (see repository).

ALTER TABLE client_api_keys
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE client_api_keys
  ADD COLUMN IF NOT EXISTS last_rotated_at TIMESTAMPTZ;

ALTER TABLE client_api_keys
  ADD COLUMN IF NOT EXISTS rotation_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN client_api_keys.expires_at IS
  'When NULL, key does not expire. When set, key is rejected after this timestamp.';

COMMENT ON COLUMN client_api_keys.last_rotated_at IS
  'Timestamp of the last key rotation. Used for audit and notification.';

COMMENT ON COLUMN client_api_keys.rotation_count IS
  'Number of times this key has been rotated. Incremented on each rotation.';

CREATE INDEX IF NOT EXISTS client_api_keys_expires_at_idx
  ON client_api_keys (expires_at)
  WHERE expires_at IS NOT NULL;

-- Set 90-day expiration on existing keys that have no expiry and were created > 7 days ago.
-- Keys created within the last 7 days get their first expiry set at 90 days from creation.
UPDATE client_api_keys
SET expires_at = created_at + INTERVAL '90 days'
WHERE expires_at IS NULL
  AND revoked_at IS NULL
  AND created_at < NOW() - INTERVAL '7 days';

-- Seed rotation_count for existing keys based on their age (1 rotation per 90 days)
UPDATE client_api_keys
SET rotation_count = LEAST(10, EXTRACT(days FROM (NOW() - created_at))::INT / 90)
WHERE rotation_count = 0
  AND expires_at IS NOT NULL;