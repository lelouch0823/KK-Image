-- 应收账款：付款记录表
-- Migration 0092: payments table for accounts receivable tracking

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    order_id TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    method TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','bank','wechat','alipay','other')),
    reference_no TEXT,
    notes TEXT,
    received_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    created_by TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id, received_at DESC);
