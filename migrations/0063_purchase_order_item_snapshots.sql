-- Migration: 0063_purchase_order_item_snapshots.sql
-- Description: Persist product snapshots on purchase order items so manual procurement history is stable.

ALTER TABLE purchase_order_items
ADD COLUMN snapshot_name TEXT;

ALTER TABLE purchase_order_items
ADD COLUMN snapshot_sku TEXT;

ALTER TABLE purchase_order_items
ADD COLUMN snapshot_specs TEXT;

ALTER TABLE purchase_order_items
ADD COLUMN snapshot_image TEXT;
