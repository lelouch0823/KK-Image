CREATE TABLE IF NOT EXISTS outbox_replay_runs (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  consumer_name TEXT,
  dry_run INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  requested_by TEXT,
  summary_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_outbox_replay_runs_scope
  ON outbox_replay_runs(scope_type, scope_id, created_at DESC);
