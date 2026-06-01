-- 多级价格体系：零售价、批发价、VIP 价
CREATE TABLE IF NOT EXISTS price_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    variant_id TEXT NOT NULL,
    price_type TEXT NOT NULL DEFAULT 'retail',  -- retail/wholesale/vip
    price REAL NOT NULL,
    valid_from INTEGER,  -- 毫秒时间戳，NULL 表示无开始限制
    valid_to INTEGER,    -- 毫秒时间戳，NULL 表示无结束限制
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

-- 同一变体同一价格类型只允许一条规则
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_rules_variant_type
    ON price_rules(variant_id, price_type);

-- 按变体查询价格规则的索引
CREATE INDEX IF NOT EXISTS idx_price_rules_variant
    ON price_rules(variant_id);
