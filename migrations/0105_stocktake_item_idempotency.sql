-- Migration number: 0105   2026-10-25
-- 盘点调整项级幂等（审查 B3）
--
-- 旧实现缺陷：adjustInventory 把整单的库存调整语句塞进 executeBatchChunks
-- （每块独立事务），差异项超过 ~16 项即跨事务；中途失败后把状态回滚为
-- counting 允许重试，重试会把已提交块的项再调整一遍——库存双倍偏移且
-- 无台账异常可循（两条 manual_adjustment 各自合法）。
--
-- 修复设计：
-- 1. stocktake_items.adjusted_at：项级"已调整"标记。每项的库存写入
--    （variants/balances/ledger/events）与该标记在同一 D1 batch 内提交；
--    重试只处理 adjusted_at IS NULL 的项，断点续跑天然幂等。
-- 2. stocktakes.adjusting_at：调整执行中的 CAS 认领时间戳。status 只在
--    全部项完成后才置 'adjusted'，中途失败保持 'counting'（如实反映
--    "部分已调整"）；并发重试由 adjusting_at 排他，认领超过 10 分钟视同
--    崩溃遗留、允许接管（与 command_idempotency 的 stale steal 语义一致）。

ALTER TABLE stocktake_items ADD COLUMN adjusted_at INTEGER;
ALTER TABLE stocktakes ADD COLUMN adjusting_at INTEGER;
