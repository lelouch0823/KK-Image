import { inClause } from '../../api/utils/sql.js';
import { chunkArray } from '../../lib/db/batch.js';

export async function prefetchOrderLineStates(db, orderIds = []) {
  const normalizedOrderIds = [...new Set((Array.isArray(orderIds) ? orderIds : []).filter(Boolean))];
  const states = new Map();

  for (const idChunk of chunkArray(normalizedOrderIds)) {
    const { results = [] } = await db
      .prepare(
        `SELECT
            order_id,
            id,
            product_id,
            variant_id,
            snapshot_name,
            snapshot_sku,
            snapshot_specs,
            snapshot_image,
            ordered_qty,
            procured_qty,
            received_qty,
            reserved_qty,
            shipped_qty,
            cancelled_qty,
            COUNT(*) OVER (PARTITION BY order_id) AS line_count,
            COALESCE(SUM(ordered_qty) OVER (PARTITION BY order_id), 0) AS total_ordered_qty,
            COALESCE(SUM(shipped_qty) OVER (PARTITION BY order_id), 0) AS total_shipped_qty,
            COALESCE(SUM(cancelled_qty) OVER (PARTITION BY order_id), 0) AS total_cancelled_qty,
            ROW_NUMBER() OVER (
              PARTITION BY order_id
              ORDER BY created_at ASC, id ASC
            ) AS row_num
         FROM order_lines
         WHERE order_id IN ${inClause(idChunk)}`
      )
      .bind(...idChunk)
      .all();

    for (const row of results) {
      if (Number(row?.row_num || 0) !== 1 || !row?.order_id) continue;
      states.set(row.order_id, row);
    }
  }

  return states;
}

export function getPrefetchedOrderLineState(prefetchedStates, orderId) {
  if (!(prefetchedStates instanceof Map) || !orderId) return null;
  return prefetchedStates.get(orderId) || null;
}
