-- Migration number: 0010   2025-12-30
-- 添加订单作废状态

-- SQLite 不支持直接修改 CHECK 约束，需要重建表
-- 但我们可以用更灵活的方式：移除 CHECK 约束，在应用层验证

-- 创建临时表
CREATE TABLE orders_new (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    salesperson_id TEXT NOT NULL,
    original_data TEXT NOT NULL,
    current_data TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending',      -- 待处理
        'confirmed',    -- 已确认
        'rejected',     -- 已驳回
        'production',   -- 生产中
        'shipping',     -- 在途
        'arrived',      -- 已到货
        'delivered',    -- 已交付
        'void'          -- 已作废
    )),
    main_image_id TEXT,
    has_new_feedback INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (salesperson_id) REFERENCES salespersons(id) ON DELETE RESTRICT,
    FOREIGN KEY (main_image_id) REFERENCES files(id) ON DELETE SET NULL
);

-- 复制数据
INSERT INTO orders_new SELECT * FROM orders;

-- 删除旧表
DROP TABLE orders;

-- 重命名新表
ALTER TABLE orders_new RENAME TO orders;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_orders_salesperson ON orders(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);
