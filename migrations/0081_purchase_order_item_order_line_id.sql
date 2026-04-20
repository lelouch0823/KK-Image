-- Migration: 0081_purchase_order_item_order_line_id.sql
-- Description: Persist bound order_line_id on purchase_order_items so multi-line order procurement can project receipts deterministically.

ALTER TABLE purchase_order_items
ADD COLUMN order_line_id TEXT REFERENCES order_lines(id) ON DELETE SET NULL;

UPDATE purchase_order_items
SET order_line_id = (
  SELECT ol.id
  FROM order_lines ol
  WHERE ol.order_id = purchase_order_items.pre_order_id
    AND COALESCE(ol.product_id, '') = COALESCE(purchase_order_items.product_id, '')
    AND COALESCE(ol.variant_id, '') = COALESCE(purchase_order_items.variant_id, '')
  ORDER BY ol.created_at ASC
  LIMIT 1
)
WHERE order_line_id IS NULL
  AND pre_order_id IS NOT NULL
  AND 1 = (
    SELECT COUNT(*)
    FROM order_lines ol
    WHERE ol.order_id = purchase_order_items.pre_order_id
      AND COALESCE(ol.product_id, '') = COALESCE(purchase_order_items.product_id, '')
      AND COALESCE(ol.variant_id, '') = COALESCE(purchase_order_items.variant_id, '')
  );

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order_line_id
  ON purchase_order_items(order_line_id);
