CREATE TABLE IF NOT EXISTS ai_action_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  status TEXT NOT NULL,
  slots_json TEXT NOT NULL DEFAULT '{}',
  preview_json TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_action_sessions_user_updated
ON ai_action_sessions(user_id, updated_at DESC);
