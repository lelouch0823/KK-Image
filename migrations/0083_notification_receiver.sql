-- Migration number: 0013   2026-01-03
-- 通知系统扩展：支持双向通知（管理端 ↔ 销售端）

-- =============================================================================
-- 添加接收方字段和销售员关联
-- =============================================================================

-- 1. 添加 receiver 字段，标识通知接收方
ALTER TABLE notifications ADD COLUMN receiver TEXT DEFAULT 'admin'
  CHECK(receiver IN ('admin', 'sales'));

-- 2. 添加 salesperson_id 字段，用于销售端通知的归属
ALTER TABLE notifications ADD COLUMN salesperson_id TEXT;

-- 3. 添加 order_id 字段，用于关联订单
ALTER TABLE notifications ADD COLUMN order_id TEXT;

-- =============================================================================
-- 优化索引
-- =============================================================================

-- 按接收方和销售员查询（销售端通知列表）
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_sales 
  ON notifications(receiver, salesperson_id, is_read, created_at DESC);

-- 按订单查询（去重检查）
CREATE INDEX IF NOT EXISTS idx_notifications_order 
  ON notifications(order_id);
