CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  title TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS chat_conversations_org_owner_updated_idx
  ON chat_conversations (organization_id, owner_email, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content_ciphertext TEXT NOT NULL,
  content_iv TEXT NOT NULL,
  content_tag TEXT NOT NULL,
  sanitized_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_decision TEXT NOT NULL CHECK (policy_decision IN ('ALLOW', 'TOKENIZE', 'BLOCK', 'REQUIRE_APPROVAL')),
  policy_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_time_idx
  ON chat_messages (conversation_id, created_at ASC);
