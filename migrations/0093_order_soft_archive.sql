-- 订单软删除/归档支持
-- Migration 0093: 为 orders 表添加归档字段

-- 添加归档时间戳和归档人字段
ALTER TABLE orders ADD COLUMN archived_at INTEGER;
ALTER TABLE orders ADD COLUMN archived_by TEXT;

-- 归档状态查询索引（优化未归档订单的常规查询）
CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(archived_at);
