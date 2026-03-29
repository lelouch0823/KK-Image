-- Migration: 0054_purchase_order_item_progress_fields.sql
-- Description: Add purchase item receipt progress columns for partial receipt projections.

ALTER TABLE purchase_order_items
ADD COLUMN received_qty INTEGER NOT NULL DEFAULT 0;

ALTER TABLE purchase_order_items
ADD COLUMN cancelled_qty INTEGER NOT NULL DEFAULT 0;

ALTER TABLE purchase_order_items
ADD COLUMN display_status TEXT NOT NULL DEFAULT 'open' CHECK(display_status IN (
  'open',
  'partially_received',
  'received',
  'cancelled'
));

UPDATE purchase_order_items
SET received_qty = (
  SELECT COALESCE(SUM(pr.received_qty), 0)
  FROM purchase_receipts pr
  WHERE pr.purchase_order_item_id = purchase_order_items.id
);

UPDATE purchase_order_items
SET display_status = CASE
  WHEN COALESCE(cancelled_qty, 0) >= COALESCE(quantity, 0) AND COALESCE(quantity, 0) > 0 THEN 'cancelled'
  WHEN COALESCE(received_qty, 0) >= COALESCE(quantity, 0) AND COALESCE(quantity, 0) > 0 THEN 'received'
  WHEN COALESCE(received_qty, 0) > 0 THEN 'partially_received'
  ELSE 'open'
END;
