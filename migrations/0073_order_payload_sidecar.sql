-- Migration number: 0073   2026-04-16
-- Split hot order payload JSON into sidecar and add lightweight summary columns.

CREATE TABLE IF NOT EXISTS order_payloads (
  order_id TEXT PRIMARY KEY,
  original_data TEXT NOT NULL,
  current_data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_payloads_updated_at
  ON order_payloads(updated_at DESC);

ALTER TABLE orders ADD COLUMN summary_name TEXT;
ALTER TABLE orders ADD COLUMN summary_brand TEXT;
ALTER TABLE orders ADD COLUMN summary_sku TEXT;

UPDATE orders
SET
  summary_name = COALESCE(NULLIF(json_extract(current_data, '$.name'), ''), NULLIF(json_extract(original_data, '$.name'), ''), ''),
  summary_brand = COALESCE(NULLIF(json_extract(current_data, '$.brand'), ''), NULLIF(json_extract(original_data, '$.brand'), ''), ''),
  summary_sku = COALESCE(
    NULLIF(json_extract(current_data, '$.sku'), ''),
    NULLIF(json_extract(current_data, '$.variant_sku'), ''),
    NULLIF(json_extract(current_data, '$.spu'), ''),
    NULLIF(json_extract(original_data, '$.sku'), ''),
    NULLIF(json_extract(original_data, '$.variant_sku'), ''),
    NULLIF(json_extract(original_data, '$.spu'), ''),
    ''
  );

INSERT INTO order_payloads (order_id, original_data, current_data, created_at, updated_at)
SELECT id, original_data, current_data, created_at, updated_at
FROM orders
WHERE 1 = 1
ON CONFLICT(order_id) DO UPDATE SET
  original_data = excluded.original_data,
  current_data = excluded.current_data,
  updated_at = excluded.updated_at;
