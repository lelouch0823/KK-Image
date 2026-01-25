-- Migration: 0021_add_products.sql
-- Description: Add products table for standard merchandise and link to orders
-- SOTA: Includes stock management, cost tracking, and SEO optimization

-- =============================================================================
-- 商品表 (Products)
-- =============================================================================
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,                    -- UUID
    name TEXT NOT NULL,                     -- 商品名称
    sku TEXT UNIQUE NOT NULL,               -- 库存单位 (Stock Keeping Unit)
    slug TEXT,                              -- URL 别名 (SEO 优化, UNIQUE via index)
    
    -- 分类与品牌
    category TEXT,                          -- 分类 (如: Handbag, Wallet)
    brand TEXT,                             -- 品牌 (如: Hermes, Chanel)
    series TEXT,                            -- 系列 (如: Birkin, Kelly)
    
    -- 价格与成本
    price REAL DEFAULT 0,                   -- 标准售价
    cost_price REAL,                        -- 成本价 (用于利润分析)
    
    -- 库存管理
    stock_quantity INTEGER DEFAULT 0,       -- 当前库存数量
    alert_threshold INTEGER DEFAULT 10,     -- 低库存预警阈值
    
    -- 详情
    description TEXT,                       -- 商品描述 (Supports Markdown)
    
    -- 媒体
    images TEXT DEFAULT '[]',               -- JSON Array of file IDs: ["file_id_1", "file_id_2"]
    
    -- 规格参数 (JSON)
    -- 用于存储尺寸、颜色选项、材质等结构化数据
    -- 示例: {"size": "25", "leather": "Togo", "hardware": "Gold"}
    specifications TEXT DEFAULT '{}',
    
    -- 状态
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'draft')),
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- =============================================================================
-- 更新订单表 (Orders)
-- =============================================================================
-- 添加 product_id 外键关联
ALTER TABLE orders ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE SET NULL;

-- 索引
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
