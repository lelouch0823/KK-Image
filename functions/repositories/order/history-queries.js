function toLineLabel(row) {
  return String(row?.line_label || row?.snapshot_name || '').trim();
}

export async function listOrderShipmentHistory(db, orderId) {
  const { results } = await db
    .prepare(
      `
        SELECT
          os.id,
          os.order_line_id,
          os.variant_id,
          os.action_type,
          os.quantity,
          os.note,
          os.created_by,
          os.created_at,
          ol.snapshot_name AS line_label
        FROM order_shipments os
        LEFT JOIN order_lines ol ON ol.id = os.order_line_id
        WHERE os.order_id = ?
        ORDER BY os.created_at DESC, os.id DESC
      `
    )
    .bind(orderId)
    .all();

  return (results || []).map((row) => ({
    id: row.id,
    orderLineId: row.order_line_id,
    variantId: row.variant_id || null,
    actionType: row.action_type || 'shipped',
    quantity: Number(row.quantity || 0),
    note: row.note || '',
    actorName: row.created_by || '',
    lineLabel: toLineLabel(row),
    createdAt: row.created_at || 0,
  }));
}

export async function listOrderReturnHistory(db, orderId) {
  const { results } = await db
    .prepare(
      `
        SELECT
          orun.id,
          orun.order_line_id,
          orun.variant_id,
          orun.quantity,
          orun.status,
          orun.reason,
          orun.note,
          orun.created_by,
          orun.created_at,
          ol.snapshot_name AS line_label
        FROM order_returns orun
        LEFT JOIN order_lines ol ON ol.id = orun.order_line_id
        WHERE orun.order_id = ?
        ORDER BY orun.created_at DESC, orun.id DESC
      `
    )
    .bind(orderId)
    .all();

  return (results || []).map((row) => ({
    id: row.id,
    orderLineId: row.order_line_id,
    variantId: row.variant_id || null,
    quantity: Number(row.quantity || 0),
    status: row.status || 'requested',
    reason: row.reason || '',
    note: row.note || '',
    createdBy: row.created_by || '',
    lineLabel: toLineLabel(row),
    createdAt: row.created_at || 0,
  }));
}
