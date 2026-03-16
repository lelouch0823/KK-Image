CREATE TABLE IF NOT EXISTS ai_request_traces (
  request_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  user_id TEXT,
  route_type TEXT,
  model TEXT,
  retry_count INTEGER DEFAULT 0,
  tool_rounds INTEGER DEFAULT 0,
  quota_decision TEXT,
  safety_decision TEXT,
  final_status TEXT,
  cancellation_reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_request_spans (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  span_type TEXT NOT NULL,
  status TEXT,
  detail TEXT,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_request_spans_request_id
  ON ai_request_spans(request_id, created_at);

CREATE TABLE IF NOT EXISTS ai_request_usage_daily (
  usage_date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  estimated_tokens INTEGER DEFAULT 0,
  PRIMARY KEY (usage_date, user_id)
);
