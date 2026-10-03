import { expandOrderProcurementStatusFilter } from '../../api/utils/constants.js';

export const ORDER_SUMMARY_PROJECTION_JOIN = `
      LEFT JOIN order_summary_projection order_summary ON order_summary.order_id = o.id
`;

export const ORDER_SUMMARY_PROGRESS_STATUS_SQL =
  "COALESCE(order_summary.display_status, o.procurement_status, 'none')";

export const ORDER_SUMMARY_EFFECTIVE_DELIVERY_STATUS_SQL = `
    CASE
        WHEN COALESCE(order_summary.shipped_qty, 0) > 0
            AND COALESCE(order_summary.returned_qty, 0) >= COALESCE(order_summary.shipped_qty, 0)
            AND COALESCE(order_summary.returned_qty, 0) > 0 THEN 'returned'
        WHEN COALESCE(order_summary.returned_qty, 0) > 0 THEN 'partially_returned'
        WHEN LOWER(TRIM(COALESCE(order_summary.effective_delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
            THEN LOWER(TRIM(order_summary.effective_delivery_status))
        WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
            THEN LOWER(TRIM(o.delivery_status))
        WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
        WHEN COALESCE(order_summary.shipped_qty, 0) > 0 THEN 'in_transit'
        ELSE 'not_shipped'
    END
`;

export const ORDER_SUMMARY_PRODUCT_SEARCH_SQL = `
    (o.order_no LIKE ? OR o.summary_name LIKE ? OR o.summary_brand LIKE ? OR o.summary_sku LIKE ? OR order_summary.snapshot_name LIKE ?)
`;

export function appendOrderSummaryProgressStatusFilter(whereClause, bindParams, procurementStatus) {
  const statusValues = expandOrderProcurementStatusFilter(procurementStatus);
  if (statusValues.length === 0) return whereClause;

  if (statusValues.length === 1) {
    bindParams.push(statusValues[0], statusValues[0]);
    return `${whereClause} AND (COALESCE(order_summary.display_status, '') = ? OR COALESCE(o.procurement_status, 'none') = ?)`;
  }

  bindParams.push(...statusValues, ...statusValues);
  return `${whereClause} AND (
        COALESCE(order_summary.display_status, '') IN (${statusValues.map(() => '?').join(', ')})
        OR COALESCE(o.procurement_status, 'none') IN (${statusValues.map(() => '?').join(', ')})
    )`;
}

/**
 * 交付状态过滤（P-H3）：
 * 投影行存在时直接命中物化列 order_summary.effective_delivery_status
 * （0072 触发器写入的值与查询期 CASE 语义一致，可走
 * idx_order_summary_projection_effective_delivery_status 索引）；
 * 投影行缺失（LEFT JOIN 未命中）时回退到 orders 基表列推导。
 * 原"整段 CASE 包裹 = ?"的写法使索引永远无法使用，带此过滤的
 * 列表退化为全表扫描。
 */
export function appendOrderSummaryDeliveryStatusFilter(whereClause, bindParams, deliveryStatus) {
  if (!deliveryStatus) return whereClause;

  const fallbackExpr = `
        CASE
            WHEN LOWER(TRIM(COALESCE(o.delivery_status, ''))) IN ('not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned')
                THEN LOWER(TRIM(o.delivery_status))
            WHEN COALESCE(o.delivered_at, 0) > 0 THEN 'delivered'
            ELSE 'not_shipped'
        END`;

  bindParams.push(deliveryStatus, deliveryStatus);
  return `${whereClause} AND (
        order_summary.effective_delivery_status = ?
        OR (order_summary.order_id IS NULL AND ${fallbackExpr} = ?)
    )`;
}

export function appendOrderSummaryProductSearchFilter(whereClause, bindParams, search) {
  if (!search) return whereClause;

  const searchPattern = `%${search}%`;
  bindParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  return `${whereClause} AND ${ORDER_SUMMARY_PRODUCT_SEARCH_SQL}`;
}
