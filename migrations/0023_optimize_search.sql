-- Migration number: 0023   2026-01-25
-- Description: Add indexes to optimize product search and filtering

-- 优化搜索性能 (LIKE name/series)
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_series ON products(series);

-- 优化价格区间筛选 (虽暂未使用，但为常见需求预留)
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
