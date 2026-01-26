-- Migration number: 0027   2026-01-26
-- 添加订单数量字段 (Quantity Field)

-- 1. 向 orders 表添加 quantity 字段，默认为 1
ALTER TABLE orders ADD COLUMN quantity INTEGER DEFAULT 1;

-- 2. 注意：既存的 original_data 和 current_data JSON 中暂时不补全，
--    业务逻辑层 (Repository) 在读取时若不存在则按 1 处理。
