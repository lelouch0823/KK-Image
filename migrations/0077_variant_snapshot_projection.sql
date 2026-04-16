-- Migration number: 0077   2026-04-16
-- Add variant snapshot projection to avoid rebuilding order-line snapshot joins on each goods overview read.

CREATE TABLE IF NOT EXISTS variant_snapshot_projection (
  variant_id TEXT PRIMARY KEY,
  product_id TEXT,
  snapshot_name TEXT,
  snapshot_sku TEXT,
  snapshot_brand TEXT,
  snapshot_category TEXT,
  current_brand TEXT,
  original_brand TEXT,
  current_category TEXT,
  original_category TEXT,
  snapshot_specs TEXT,
  snapshot_image TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_variant_snapshot_projection_product_id
  ON variant_snapshot_projection(product_id);

CREATE INDEX IF NOT EXISTS idx_variant_snapshot_projection_updated_at
  ON variant_snapshot_projection(updated_at DESC);

INSERT INTO variant_snapshot_projection (
  variant_id,
  product_id,
  snapshot_name,
  snapshot_sku,
  snapshot_brand,
  snapshot_category,
  current_brand,
  original_brand,
  current_category,
  original_category,
  snapshot_specs,
  snapshot_image,
  updated_at
)
SELECT
  ol.variant_id AS variant_id,
  MAX(ol.product_id) AS product_id,
  MAX(ol.snapshot_name) AS snapshot_name,
  MAX(ol.snapshot_sku) AS snapshot_sku,
  MAX(json_extract(ol.snapshot_specs, '$.brand')) AS snapshot_brand,
  MAX(json_extract(ol.snapshot_specs, '$.category')) AS snapshot_category,
  MAX(CASE WHEN json_valid(o.current_data) THEN json_extract(o.current_data, '$.brand') END) AS current_brand,
  MAX(CASE WHEN json_valid(o.original_data) THEN json_extract(o.original_data, '$.brand') END) AS original_brand,
  MAX(CASE WHEN json_valid(o.current_data) THEN json_extract(o.current_data, '$.category') END) AS current_category,
  MAX(CASE WHEN json_valid(o.original_data) THEN json_extract(o.original_data, '$.category') END) AS original_category,
  MAX(ol.snapshot_specs) AS snapshot_specs,
  MAX(ol.snapshot_image) AS snapshot_image,
  MAX(COALESCE(o.updated_at, o.created_at, ol.updated_at, ol.created_at)) AS updated_at
FROM order_lines ol
JOIN orders o ON o.id = ol.order_id
WHERE ol.variant_id IS NOT NULL
GROUP BY ol.variant_id
ON CONFLICT(variant_id) DO UPDATE SET
  product_id = excluded.product_id,
  snapshot_name = excluded.snapshot_name,
  snapshot_sku = excluded.snapshot_sku,
  snapshot_brand = excluded.snapshot_brand,
  snapshot_category = excluded.snapshot_category,
  current_brand = excluded.current_brand,
  original_brand = excluded.original_brand,
  current_category = excluded.current_category,
  original_category = excluded.original_category,
  snapshot_specs = excluded.snapshot_specs,
  snapshot_image = excluded.snapshot_image,
  updated_at = excluded.updated_at;
