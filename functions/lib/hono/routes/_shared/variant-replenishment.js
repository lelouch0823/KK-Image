export async function loadVariantReplenishmentMap(db, variantIds = []) {
  const normalizedIds = [...new Set((variantIds || []).filter(Boolean))];
  if (normalizedIds.length === 0) return new Map();

  const placeholders = normalizedIds.map(() => '?').join(',');
  const sql = `
    SELECT
      poi.variant_id,
      SUM(MAX(COALESCE(poi.quantity, 0) - COALESCE(poi.received_qty, 0) - COALESCE(poi.cancelled_qty, 0), 0)) AS replenishment_quantity,
      COUNT(DISTINCT poi.po_id) AS replenishment_po_count
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.po_id
    WHERE poi.variant_id IN (${placeholders})
      AND po.status IN ('ordered', 'shipping')
    GROUP BY poi.variant_id
  `;

  const result = await db.prepare(sql).bind(...normalizedIds).all();
  const map = new Map();
  for (const row of result?.results || []) {
    map.set(row.variant_id, {
      replenishment_quantity: Number(row.replenishment_quantity || 0),
      replenishment_po_count: Number(row.replenishment_po_count || 0),
    });
  }
  return map;
}
