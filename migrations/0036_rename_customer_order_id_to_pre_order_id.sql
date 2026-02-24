-- Migration: 0036_rename_customer_order_id_to_pre_order_id.sql
-- Description: 重命名 purchase_order_items 表中的 customer_order_id 为 pre_order_id 以符合业务含义

ALTER TABLE purchase_order_items RENAME COLUMN customer_order_id TO pre_order_id;

-- 更新索引名称
DROP INDEX IF EXISTS idx_po_items_order;
CREATE INDEX IF NOT EXISTS idx_po_items_pre_order ON purchase_order_items(pre_order_id);
