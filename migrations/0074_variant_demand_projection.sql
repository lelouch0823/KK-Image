-- Migration number: 0074   2026-04-16
-- Add variant demand projection for goods overview and purchase suggestions.

CREATE TABLE IF NOT EXISTS variant_demand_projection (
  variant_id TEXT PRIMARY KEY,
  confirmed_qty INTEGER NOT NULL DEFAULT 0,
  production_qty INTEGER NOT NULL DEFAULT 0,
  shipping_qty INTEGER NOT NULL DEFAULT 0,
  arrived_qty INTEGER NOT NULL DEFAULT 0,
  total_demand INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  order_ids TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_variant_demand_projection_total_demand
  ON variant_demand_projection(total_demand DESC);

CREATE INDEX IF NOT EXISTS idx_variant_demand_projection_updated_at
  ON variant_demand_projection(updated_at DESC);

INSERT INTO variant_demand_projection (
  variant_id,
  confirmed_qty,
  production_qty,
  shipping_qty,
  arrived_qty,
  total_demand,
  order_count,
  order_ids,
  updated_at
)
SELECT
  ol.variant_id AS variant_id,
  COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) ELSE 0 END), 0) AS confirmed_qty,
  COALESCE(SUM(CASE WHEN o.status = 'production' THEN MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) ELSE 0 END), 0) AS production_qty,
  COALESCE(SUM(CASE WHEN o.status = 'shipping' THEN MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) ELSE 0 END), 0) AS shipping_qty,
  COALESCE(SUM(CASE WHEN o.status = 'arrived' THEN MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0) ELSE 0 END), 0) AS arrived_qty,
  COALESCE(SUM(MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0)), 0) AS total_demand,
  COUNT(DISTINCT o.id) AS order_count,
  GROUP_CONCAT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.id END) AS order_ids,
  MAX(COALESCE(o.updated_at, o.created_at, ol.updated_at, ol.created_at)) AS updated_at
FROM order_lines ol
JOIN orders o ON o.id = ol.order_id
WHERE o.status IN ('confirmed', 'production', 'shipping', 'arrived')
  AND ol.variant_id IS NOT NULL
GROUP BY ol.variant_id
ON CONFLICT(variant_id) DO UPDATE SET
  confirmed_qty = excluded.confirmed_qty,
  production_qty = excluded.production_qty,
  shipping_qty = excluded.shipping_qty,
  arrived_qty = excluded.arrived_qty,
  total_demand = excluded.total_demand,
  order_count = excluded.order_count,
  order_ids = excluded.order_ids,
  updated_at = excluded.updated_at;
