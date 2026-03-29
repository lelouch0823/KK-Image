-- Persist source-aware dedupe metadata for outbox-driven notifications

ALTER TABLE notifications ADD COLUMN source_consumer TEXT;
ALTER TABLE notifications ADD COLUMN source_event_id TEXT;
ALTER TABLE notifications ADD COLUMN dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_dedupe
  ON notifications(source_consumer, dedupe_key, receiver, COALESCE(salesperson_id, ''));
