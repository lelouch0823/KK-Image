-- Migration number: 0101   2026-10-03
-- 支付域扩展（审查 B-M9/C-H4）：
-- 1. payments 增加 type 列（payment/refund），退款以负额记录，
--    使所有 SUM(amount) 汇总（已付/应收/账龄）自然净额化；
-- 2. 重建表以修改 CHECK：amount != 0（原 CHECK(amount>0) 无法容纳负额退款）；
-- 3. (order_id, reference_no) 唯一索引 + 重复数据清理：
--    幂等缺失时代码层无法阻止重试产生的同参考号重复收款，数据库层兜底；
--    历史重复按 received_at 保留最早一条（即重复重试的原始记录）。

CREATE TABLE IF NOT EXISTS payments_safe (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    order_id TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount != 0),
    type TEXT NOT NULL DEFAULT 'payment' CHECK(type IN ('payment','refund')),
    method TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','bank','wechat','alipay','other')),
    reference_no TEXT,
    notes TEXT,
    received_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    created_by TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

INSERT INTO payments_safe (id, order_id, amount, type, method, reference_no, notes, received_at, created_by)
SELECT id, order_id, amount, 'payment', method, reference_no, notes, received_at, created_by
FROM payments;

-- 清理幂等缺失时期产生的同参考号重复收款（保留最早一条）
DELETE FROM payments_safe
WHERE reference_no IS NOT NULL AND reference_no != ''
  AND rowid NOT IN (
    SELECT MIN(rowid) FROM payments_safe
    WHERE reference_no IS NOT NULL AND reference_no != ''
    GROUP BY order_id, reference_no
  );

DROP TABLE payments;
ALTER TABLE payments_safe RENAME TO payments;

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_reference
  ON payments(order_id, reference_no)
  WHERE reference_no IS NOT NULL AND reference_no != '';
