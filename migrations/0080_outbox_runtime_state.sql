-- Migration number: 0080   2026-04-16
-- Add outbox runtime lease table to reduce redundant poller churn.

CREATE TABLE IF NOT EXISTS outbox_runtime_state (
  scope TEXT PRIMARY KEY,
  lease_token TEXT NOT NULL,
  leased_by TEXT NOT NULL,
  leased_until INTEGER NOT NULL,
  last_started_at INTEGER NOT NULL,
  last_finished_at INTEGER,
  last_claimed_count INTEGER NOT NULL DEFAULT 0,
  last_published_count INTEGER NOT NULL DEFAULT 0,
  last_failed_count INTEGER NOT NULL DEFAULT 0,
  last_backlog_count INTEGER,
  last_round_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_runtime_state_lease_until
  ON outbox_runtime_state(leased_until);
