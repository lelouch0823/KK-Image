-- Migration 0086: 客户标签表和客户统计增强
-- 客户标签独立表，支持更灵活的标签管理

-- 1. 创建客户标签表
CREATE TABLE IF NOT EXISTS customer_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    UNIQUE(customer_id, tag_name)
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer_id ON customer_tags(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag_name ON customer_tags(tag_name);

-- 3. 创建客户统计视图（便于查询）
CREATE VIEW IF NOT EXISTS customer_order_stats AS
SELECT
    c.id AS customer_id,
    COUNT(o.id) AS order_count,
    MIN(o.created_at) AS first_order_at,
    MAX(o.created_at) AS last_order_at
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id;
