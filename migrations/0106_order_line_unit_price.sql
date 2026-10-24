-- Migration number: 0106   2026-10-25
-- 订单行单价快照（审查 B9）
--
-- 旧缺陷：应收/收款上限按"当前变体售价 × ordered_qty"计算——
--   1. 变体改价会追溯改变已建订单的可收上限（可超收或误拒）；
--   2. cancelled_qty 不扣减，已取消数量仍计入应收；
--   3. 未绑定变体的行按 0 计，订单应收为 0，任何收款都被拒绝。
--
-- 修复：order_lines 落地下单时点的单价快照。金额表达式统一为
--   (ordered_qty - cancelled_qty) * COALESCE(unit_price, pv.price, 0)
-- （PaymentRepository / OrderStatsRepository 共享，见
--   functions/api/utils/order-amount-sql.js）。存量行以当前售价回填
-- （尽力而为：历史真实成交价不可考，快照语义自迁移时点起完整生效）。

ALTER TABLE order_lines ADD COLUMN unit_price REAL;

UPDATE order_lines
SET unit_price = (SELECT pv.price FROM product_variants pv WHERE pv.id = order_lines.variant_id)
WHERE variant_id IS NOT NULL;
