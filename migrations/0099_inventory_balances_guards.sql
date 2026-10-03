-- Migration number: 0099   2026-10-03
-- 库存余额完整性加固（并发审查 C-H1/C-H2）：
-- 1. 重建 inventory_balances，补 CHECK 约束：on_hand 与 reserved 非负。
--    注意 available 不设 CHECK：available = MAX(on_hand - reserved, 0)，
--    订单级预留是需求驱动的软锁定（预订/backorder 模式），允许 reserved > on_hand；
-- 2. 迁移时一次性对账：负值钳回下限、available 严格重算；
-- 3. 为缺失余额行的变体回填（以 product_variants.stock_quantity 为初始 on_hand）。

CREATE TABLE IF NOT EXISTS inventory_balances_safe (
  variant_id TEXT PRIMARY KEY,
  on_hand INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  CHECK (on_hand >= 0 AND reserved >= 0),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

INSERT INTO inventory_balances_safe (variant_id, on_hand, reserved, available, updated_at)
SELECT
  variant_id,
  MAX(on_hand, 0) AS on_hand,
  MAX(reserved, 0) AS reserved,
  MAX(MAX(on_hand, 0) - MAX(reserved, 0), 0) AS available,
  updated_at
FROM inventory_balances
GROUP BY variant_id;

-- 回填从未写过余额的变体（此前 UPSERT 只在第一次写入时建行）
INSERT OR IGNORE INTO inventory_balances_safe (variant_id, on_hand, reserved, available, updated_at)
SELECT
  pv.id,
  MAX(pv.stock_quantity, 0),
  0,
  MAX(pv.stock_quantity, 0),
  unixepoch() * 1000
FROM product_variants pv
WHERE pv.id NOT IN (SELECT variant_id FROM inventory_balances);

DROP TABLE inventory_balances;
ALTER TABLE inventory_balances_safe RENAME TO inventory_balances;

CREATE INDEX IF NOT EXISTS idx_inventory_balances_available
  ON inventory_balances(available DESC);
