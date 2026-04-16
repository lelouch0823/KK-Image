-- Migration number: 0078   2026-04-16
-- Add per-event webhook subscription table so deliveries do not scan JSON arrays.

CREATE TABLE IF NOT EXISTS webhook_event_subscriptions (
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (webhook_id, event_type),
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_subscriptions_event
  ON webhook_event_subscriptions(event_type, webhook_id);

INSERT OR IGNORE INTO webhook_event_subscriptions (webhook_id, event_type)
SELECT
  w.id,
  je.value
FROM webhooks w,
     json_each(CASE WHEN json_valid(w.events) THEN w.events ELSE '[]' END) je
WHERE je.type = 'text';

DROP TRIGGER IF EXISTS trg_webhook_event_subscriptions_ai;
CREATE TRIGGER IF NOT EXISTS trg_webhook_event_subscriptions_ai
AFTER INSERT ON webhooks
BEGIN
  DELETE FROM webhook_event_subscriptions WHERE webhook_id = NEW.id;
  INSERT OR IGNORE INTO webhook_event_subscriptions (webhook_id, event_type)
  SELECT
    NEW.id,
    je.value
  FROM json_each(CASE WHEN json_valid(NEW.events) THEN NEW.events ELSE '[]' END) je
  WHERE je.type = 'text';
END;

DROP TRIGGER IF EXISTS trg_webhook_event_subscriptions_au;
CREATE TRIGGER IF NOT EXISTS trg_webhook_event_subscriptions_au
AFTER UPDATE OF events ON webhooks
BEGIN
  DELETE FROM webhook_event_subscriptions WHERE webhook_id = NEW.id;
  INSERT OR IGNORE INTO webhook_event_subscriptions (webhook_id, event_type)
  SELECT
    NEW.id,
    je.value
  FROM json_each(CASE WHEN json_valid(NEW.events) THEN NEW.events ELSE '[]' END) je
  WHERE je.type = 'text';
END;

DROP TRIGGER IF EXISTS trg_webhook_event_subscriptions_ad;
CREATE TRIGGER IF NOT EXISTS trg_webhook_event_subscriptions_ad
AFTER DELETE ON webhooks
BEGIN
  DELETE FROM webhook_event_subscriptions WHERE webhook_id = OLD.id;
END;
