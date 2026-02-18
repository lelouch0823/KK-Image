-- Migration: 0022_optimize_products.sql
-- SOTA Enhancement Patch: 为已有的 products 表添加缺失字段
-- (仅用于本地开发环境，远程将直接使用更新后的 0021)
-- 注意：0021_add_products.sql 已经包含了这些字段，故在本地环境将其注释以避免冲突。

-- P0: 库存管理
-- ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0;
-- ALTER TABLE products ADD COLUMN alert_threshold INTEGER DEFAULT 10;

-- P1: 成本追踪
-- ALTER TABLE products ADD COLUMN cost_price REAL;

-- P1: SEO 优化 (SQLite 不允许 ALTER TABLE ADD COLUMN ... UNIQUE)
-- ALTER TABLE products ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
