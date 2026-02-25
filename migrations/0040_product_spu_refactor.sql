-- Migration: 0040_product_spu_refactor.sql
-- Description: 将 products.sku 替换为 products.spu (可选, UNIQUE)
-- 属于硬切换迁移: 旧 sku 数据复制到 spu，删除 sku 列

-- SQLite 不支持 DROP COLUMN / RENAME COLUMN 的完整语义,
-- 因此使用标准的 "重建表" 策略.

-- Step 1: 创建新表结构 (spu 替换 sku, 可为 NULL)
CREATE TABLE products_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    spu TEXT UNIQUE,                        -- 标准产品单元 (Standard Product Unit), 可为空
    slug TEXT,
    category TEXT,
    brand TEXT,
    series TEXT,
    price REAL DEFAULT 0,
    cost_price REAL,
    stock_quantity INTEGER DEFAULT 0,
    alert_threshold INTEGER DEFAULT 10,
    description TEXT,
    images TEXT DEFAULT '[]',
    specifications TEXT DEFAULT '{}',
    options TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'draft')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Step 2: 将旧数据复制到新表 (sku -> spu, 空字符串转 NULL)
INSERT INTO products_new (id, name, spu, slug, category, brand, series, price, cost_price,
    stock_quantity, alert_threshold, description, images, specifications, options, status,
    created_at, updated_at)
SELECT id, name, NULLIF(sku, ''), slug, category, brand, series, price, cost_price,
    stock_quantity, alert_threshold, description, images, specifications, options, status,
    created_at, updated_at
FROM products;

-- Step 3: 删除旧表, 重命名新表
DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

-- Step 4: 重建索引 (spu 替换 sku)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_spu ON products(spu);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
