ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS daily_spend_limit INTEGER NOT NULL DEFAULT 5000 CHECK (daily_spend_limit >= 0),
  ADD COLUMN IF NOT EXISTS current_daily_spend INTEGER NOT NULL DEFAULT 0 CHECK (current_daily_spend >= 0),
  ADD COLUMN IF NOT EXISTS daily_spend_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS organizations_daily_spend_date_idx
  ON organizations (daily_spend_date);
