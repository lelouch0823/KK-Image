-- Migration: 0048_add_orders_procurement_status.sql
-- Description: Add procurement_status to orders and backfill from legacy order status.

ALTER TABLE orders
ADD COLUMN procurement_status TEXT DEFAULT 'none' CHECK(procurement_status IN (
  'none',
  'planned',
  'ordered',
  'partially_arrived',
  'arrived'
));

UPDATE orders
SET procurement_status = CASE
  WHEN status IN ('production', 'shipping') THEN 'ordered'
  WHEN status IN ('arrived', 'delivered') THEN 'arrived'
  ELSE 'none'
END
WHERE procurement_status IS NULL OR procurement_status = '';

CREATE INDEX IF NOT EXISTS idx_orders_procurement_status ON orders(procurement_status);
