ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS audit_retention_days INTEGER NOT NULL DEFAULT 30 CHECK (audit_retention_days BETWEEN 1 AND 365);
