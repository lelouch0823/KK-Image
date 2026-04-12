import { expandOrderProcurementStatusFilter } from '../../api/utils/constants.js';

export const ORDER_LINE_STATUS_AGGREGATE_JOIN = `
      LEFT JOIN (
          SELECT
              aggregate_lines.order_id,
              CASE
                  WHEN aggregate_lines.ordered_qty > 0 AND aggregate_lines.cancelled_qty >= aggregate_lines.ordered_qty THEN 'cancelled'
                  WHEN aggregate_lines.remaining_qty > 0 AND aggregate_lines.shipped_qty >= aggregate_lines.remaining_qty THEN 'completed'
                  WHEN aggregate_lines.shipped_qty > 0 THEN 'partially_shipped'
                  WHEN aggregate_lines.remaining_qty > 0 AND aggregate_lines.received_qty >= aggregate_lines.remaining_qty THEN 'ready'
                  WHEN aggregate_lines.received_qty > 0 THEN 'partially_received'
                  WHEN aggregate_lines.remaining_qty > 0 AND aggregate_lines.procured_qty >= aggregate_lines.remaining_qty THEN 'fully_procured'
                  WHEN aggregate_lines.procured_qty > 0 THEN 'partially_procured'
                  ELSE 'unprocured'
              END AS display_status
          FROM (
              SELECT
                  summarized.order_id,
                  summarized.ordered_qty,
                  summarized.procured_qty,
                  summarized.received_qty,
                  summarized.shipped_qty,
                  summarized.cancelled_qty,
                  MAX(summarized.ordered_qty - summarized.cancelled_qty, 0) AS remaining_qty
              FROM (
                  SELECT
                      order_id,
                      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
                      COALESCE(SUM(procured_qty), 0) AS procured_qty,
                      COALESCE(SUM(received_qty), 0) AS received_qty,
                      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
                      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
                  FROM order_lines
                  GROUP BY order_id
              ) summarized
          ) aggregate_lines
      ) order_line_agg ON order_line_agg.order_id = o.id
`;

export const ORDER_LINE_PRIMARY_SNAPSHOT_JOIN = `
      LEFT JOIN (
          SELECT ranked_lines.order_id, ranked_lines.snapshot_name
          FROM (
              SELECT
                  order_id,
                  snapshot_name,
                  ROW_NUMBER() OVER (
                      PARTITION BY order_id
                      ORDER BY created_at ASC, id ASC
                  ) AS row_num
              FROM order_lines
              WHERE COALESCE(snapshot_name, '') != ''
          ) ranked_lines
          WHERE ranked_lines.row_num = 1
      ) order_line_snapshot ON order_line_snapshot.order_id = o.id
`;

export const ORDER_PROGRESS_STATUS_SQL = "COALESCE(order_line_agg.display_status, o.procurement_status, 'none')";

export function appendOrderProgressStatusFilter(whereClause, bindParams, procurementStatus) {
    const statusValues = expandOrderProcurementStatusFilter(procurementStatus);
    if (statusValues.length === 0) return whereClause;

    if (statusValues.length === 1) {
        bindParams.push(statusValues[0]);
        return `${whereClause} AND ${ORDER_PROGRESS_STATUS_SQL} = ?`;
    }

    bindParams.push(...statusValues);
    return `${whereClause} AND ${ORDER_PROGRESS_STATUS_SQL} IN (${statusValues.map(() => "?").join(", ")})`;
}

export function appendOrderProductSearchFilter(whereClause, bindParams, search) {
    if (!search) return whereClause;

    const searchPattern = `%${search}%`;
    bindParams.push(searchPattern, searchPattern, searchPattern);
    return `${whereClause} AND (o.order_no LIKE ? OR o.current_data LIKE ? OR order_line_snapshot.snapshot_name LIKE ?)`;
}
