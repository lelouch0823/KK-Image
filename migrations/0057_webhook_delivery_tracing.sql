ALTER TABLE webhook_logs ADD COLUMN event_id TEXT;
ALTER TABLE webhook_logs ADD COLUMN delivery_key TEXT;
ALTER TABLE webhook_logs ADD COLUMN attempt_number INTEGER;
ALTER TABLE webhook_logs ADD COLUMN classification TEXT;
ALTER TABLE webhook_logs ADD COLUMN next_retry_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_delivery_key
  ON webhook_logs(delivery_key, webhook_id, success, created_at DESC);
