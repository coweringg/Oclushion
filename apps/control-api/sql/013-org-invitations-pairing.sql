-- ============================================================================
-- Migration: 013-org-invitations-pairing.sql
-- Purpose:   Organization invitations, pairing codes, and trial management
-- ============================================================================

-- ── Organization Invitations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'developer' CHECK (role IN ('owner', 'admin', 'security_officer', 'auditor', 'developer', 'viewer')),
    invitation_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    invited_by      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    created_at      TIMESTAMPTZ DEFAULT now(),
    accepted_at     TIMESTAMPTZ,
    accepted_by     UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_code           ON organization_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitations_org_status      ON organization_invitations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_email         ON organization_invitations(email);

-- ── Pairing Codes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pairing_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    code            TEXT UNIQUE NOT NULL DEFAULT ('OCL-' || upper(encode(gen_random_bytes(6), 'hex'))),
    created_by      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    max_uses        INTEGER DEFAULT 1,
    used_count      INTEGER DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
    created_at      TIMESTAMPTZ DEFAULT now(),
    used_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_code          ON pairing_codes(code);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_org_status    ON pairing_codes(organization_id, status);

-- ── Trial Management ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trial_settings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL UNIQUE REFERENCES organizations(organization_id) ON DELETE CASCADE,
    trial_ends_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
    trial_max_members     INTEGER DEFAULT 5,
    trial_extended_days   INTEGER DEFAULT 0,
    status                TEXT DEFAULT 'trialing' CHECK (status IN ('trialing', 'converted', 'expired', 'extended')),
    reminder_sent_at      TIMESTAMPTZ,
    upgraded_at           TIMESTAMPTZ,
    upgraded_plan         TEXT,
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_settings_org    ON trial_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_trial_settings_expiry ON trial_settings(trial_ends_at);
