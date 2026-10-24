/**
 * 订单行金额 SQL 表达式（单一真源）
 *
 * 语义：净数量（ordered - cancelled）× 单价快照（下单时点价，迁移 0106；
 * 快照缺失时回退当前变体售价，未绑定变体按 0 计）。
 *
 * 使用方必须以 `ol` 引用 order_lines、以 `pv` 引用 LEFT JOIN 的
 * product_variants（别名与既有查询约定一致）。
 */
export const ORDER_LINE_NET_AMOUNT_SQL =
  '(ol.ordered_qty - COALESCE(ol.cancelled_qty, 0)) * COALESCE(ol.unit_price, pv.price, 0)';
