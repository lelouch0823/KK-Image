-- Migration 0087: 客户沟通记录表
-- 独立的客户跟进日志，区别于订单时间线

CREATE TABLE IF NOT EXISTS customer_communications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    customer_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'note' CHECK(type IN ('note','call','email','meeting','wechat','other')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    created_by TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_communications_customer
    ON customer_communications(customer_id, created_at DESC);
