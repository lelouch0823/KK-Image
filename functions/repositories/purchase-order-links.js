import { chunkArray } from '../lib/db/batch.js';

const D1_MAX_IN_CLAUSE_SIZE = 100;

export async function getLinkedOrderIds({ db, poId }) {
  const { results } = await db
    .prepare(
      'SELECT DISTINCT pre_order_id FROM purchase_order_items WHERE po_id = ? AND pre_order_id IS NOT NULL'
    )
    .bind(poId)
    .all();
  return results.map((row) => row.pre_order_id);
}

export async function findActiveBindingsByPreOrderIds({ db, preOrderIds = [] }) {
  const normalizedIds = [...new Set((preOrderIds || []).filter(Boolean))];
  if (normalizedIds.length === 0) return [];

  const bindings = [];
  for (const orderIdChunk of chunkArray(normalizedIds, D1_MAX_IN_CLAUSE_SIZE)) {
    const placeholders = orderIdChunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `
        SELECT
          poi.pre_order_id,
          poi.po_id,
          po.po_no,
          po.status AS po_status
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.po_id
        WHERE poi.pre_order_id IN (${placeholders})
          AND po.status != 'cancelled'
      `
      )
      .bind(...orderIdChunk)
      .all();
    bindings.push(...(results || []));
  }

  return bindings;
}

export async function getLastPurchasePricesByVariant({ db, variantIds = [] }) {
  if (!variantIds || variantIds.length === 0) return {};

  const priceMap = {};
  for (const variantIdChunk of chunkArray(variantIds, D1_MAX_IN_CLAUSE_SIZE)) {
    const placeholders = variantIdChunk.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `
      SELECT latest.variant_id, poi.unit_cost AS last_purchase_price
      FROM (
        SELECT poi2.variant_id,
               MAX(COALESCE(po2.completed_at, po2.updated_at, po2.created_at, 0)) AS latest_ts
        FROM purchase_order_items poi2
        JOIN purchase_orders po2 ON po2.id = poi2.po_id
        WHERE po2.status = 'completed'
          AND poi2.variant_id IN (${placeholders})
        GROUP BY poi2.variant_id
      ) latest
      JOIN purchase_order_items poi ON poi.variant_id = latest.variant_id
      JOIN purchase_orders po ON po.id = poi.po_id
      WHERE po.status = 'completed'
        AND COALESCE(po.completed_at, po.updated_at, po.created_at, 0) = latest.latest_ts
    `
      )
      .bind(...variantIdChunk)
      .all();

    for (const row of results || []) {
      if (priceMap[row.variant_id] == null) {
        priceMap[row.variant_id] = Number(row.last_purchase_price) || 0;
      }
    }
  }

  return priceMap;
}
