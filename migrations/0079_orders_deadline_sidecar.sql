-- Migration number: 0079   2026-04-16
-- Materialize order deadline into a scalar sidecar column for reminder-range scans.

ALTER TABLE orders ADD COLUMN deadline_date TEXT;

UPDATE orders
SET deadline_date = CASE
  WHEN json_valid(current_data) THEN NULLIF(TRIM(json_extract(current_data, '$.deadline')), '')
  ELSE NULL
END
WHERE deadline_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_deadline_date
  ON orders(status, deadline_date, created_at);
