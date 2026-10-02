-- 库存事件台账的看板查询索引
--
-- InventoryDashboardRepository 的两个热查询此前只能全表扫描：
-- 1) getRecentMovements: ORDER BY occurred_at DESC LIMIT ?
-- 2) getTopMovingItems : WHERE event_type IN (...) AND occurred_at >= ? GROUP BY variant_id
-- 库存台账随业务持续增长，缺索引会让看板查询成本随台账体积线性上升。

CREATE INDEX IF NOT EXISTS idx_inventory_events_occurred_at
  ON inventory_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_inventory_events_event_type_occurred_at
  ON inventory_events(event_type, occurred_at);
