-- Migration 0084: 商品投影表
-- 解决 ProductRepository._variantAggregateCTE() 每次查询都全表扫描 product_variants 的性能瓶颈
-- 将变体聚合数据预计算到投影表，查询时 O(1) 查找替代 O(M) 全表 GROUP BY

CREATE TABLE IF NOT EXISTS product_projection (
    product_id TEXT PRIMARY KEY,
    min_price REAL DEFAULT 0,
    min_cost_price REAL DEFAULT 0,
    total_stock INTEGER DEFAULT 0,
    total_available INTEGER DEFAULT 0,
    min_alert_threshold INTEGER DEFAULT 10,
    active_variant_count INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 价格排序索引
CREATE INDEX IF NOT EXISTS idx_product_projection_price ON product_projection(min_price);
-- 可用库存排序索引
CREATE INDEX IF NOT EXISTS idx_product_projection_available ON product_projection(total_available);
-- 活跃变体数过滤索引
CREATE INDEX IF NOT EXISTS idx_product_projection_active ON product_projection(active_variant_count);

-- 初始填充：从 product_variants + inventory_balances 聚合
INSERT OR REPLACE INTO product_projection (
    product_id, min_price, min_cost_price, total_stock, total_available,
    min_alert_threshold, active_variant_count, updated_at
)
SELECT
    pv.product_id,
    MIN(CASE WHEN pv.status = 'active' THEN pv.price END) AS min_price,
    MIN(CASE WHEN pv.status = 'active' THEN COALESCE(pv.cost_price, 0) END) AS min_cost_price,
    SUM(CASE WHEN pv.status = 'active' THEN COALESCE(ib.on_hand, pv.stock_quantity, 0) ELSE 0 END) AS total_stock,
    SUM(CASE WHEN pv.status = 'active' THEN COALESCE(ib.available, pv.stock_quantity, 0) ELSE 0 END) AS total_available,
    MIN(CASE WHEN pv.status = 'active' THEN COALESCE(pv.alert_threshold, 10) END) AS min_alert_threshold,
    SUM(CASE WHEN pv.status = 'active' THEN 1 ELSE 0 END) AS active_variant_count,
    unixepoch() * 1000
FROM product_variants pv
LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
GROUP BY pv.product_id;
