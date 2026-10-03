-- Migration number: 0104   2026-10-03
-- 订单列表排序索引（P-H2 实测结论，部分索引版）
--
-- 此前两个订单列表（管理端/销售端）的 ORDER BY 含 status 优先级 CASE 表达式，
-- SQLite 无法用任何索引满足排序，每次列表请求都对全部命中行做阻塞排序
-- （5 万行实测：管理端全量首页 34ms/请求，与页深无关）。
--
-- 表达式索引让 ORDER BY 直接按索引序输出。实测（50 万单）：
-- 默认视图首页 0.03ms、第 100 页 0.13ms、最后一页（第 25000 页）29.7ms。
--
-- 必须是部分索引（WHERE archived_at IS NULL）：默认视图永远携带
-- archived_at IS NULL 过滤，若归档标记不在索引内，OFFSET 跳过的每一行
-- 都要回表判断归档状态（50 万单最后一页实测 600ms 级）；内建于索引后
-- 深页变成纯索引游标走（同规模 29.7ms）。
--
-- 已知取舍：includeArchived=true（不带归档过滤的管理视图）无法命中
-- 部分索引，回退阻塞排序（50 万行约 205ms，5 万行约 20ms）。该视图罕见
-- 且 API 支持 startTime/endTime/status 筛选收窄集合，不为它把写放大翻倍。
--
-- ⚠️ CASE 表达式必须与 functions/lib/db/order-sort-sql.js 的
--    ORDER_STATUS_PRIORITY_CASE 保持语义一致（索引内使用裸列名），
--    修改状态优先级时必须同步更新本文件。

CREATE INDEX IF NOT EXISTS idx_orders_admin_list_sort ON orders(
  unread_by_admin DESC,
  CASE status
    WHEN 'pending' THEN 1
    WHEN 'production' THEN 2
    WHEN 'shipping' THEN 3
    WHEN 'confirmed' THEN 4
    WHEN 'arrived' THEN 5
    WHEN 'fulfilled' THEN 6
    WHEN 'delivered' THEN 6
    WHEN 'rejected' THEN 7
    WHEN 'void' THEN 99
    ELSE 50
  END,
  created_at DESC
) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_sales_list_sort ON orders(
  unread_by_sales DESC,
  CASE status
    WHEN 'pending' THEN 1
    WHEN 'production' THEN 2
    WHEN 'shipping' THEN 3
    WHEN 'confirmed' THEN 4
    WHEN 'arrived' THEN 5
    WHEN 'fulfilled' THEN 6
    WHEN 'delivered' THEN 6
    WHEN 'rejected' THEN 7
    WHEN 'void' THEN 99
    ELSE 50
  END,
  created_at DESC
) WHERE archived_at IS NULL;
