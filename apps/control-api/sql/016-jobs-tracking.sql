CREATE TABLE IF NOT EXISTS async_jobs (
  id            TEXT PRIMARY KEY,
  queue_name    TEXT NOT NULL,
  job_type      TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'queued',
  result        JSONB,
  error         TEXT,
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  organization_id TEXT NOT NULL
);

CREATE INDEX idx_async_jobs_org_status ON async_jobs (organization_id, status);
CREATE INDEX idx_async_jobs_type_status ON async_jobs (job_type, status);
CREATE INDEX idx_async_jobs_created ON async_jobs (created_at DESC);

COMMENT ON TABLE async_jobs IS 'Tracks async job execution for BullMQ-based workers';
COMMENT ON COLUMN async_jobs.payload IS 'Job input payload (JSON)';
COMMENT ON COLUMN async_jobs.result IS 'Job completion result (JSON)';
COMMENT ON COLUMN async_jobs.error IS 'Error message if job failed';
