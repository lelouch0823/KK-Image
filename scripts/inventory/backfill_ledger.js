import { randomUUID } from 'node:crypto';

export function buildBackfillLedgerRows(variants = [], activeOrders = [], timestamp = Date.now()) {
  const rows = [];

  for (const variant of variants) {
    const variantId = String(variant?.id || '').trim();
    const stockQuantity = Number(variant?.stock_quantity || 0);
    if (!variantId || stockQuantity <= 0) continue;

    rows.push({
      id: randomUUID(),
      variant_id: variantId,
      event_type: 'inventory_correction',
      quantity_delta: stockQuantity,
      reference_type: 'cutover_backfill',
      reference_id: variantId,
      occurred_at: timestamp,
      metadata: JSON.stringify({ source: 'product_variants.stock_quantity' }),
      created_at: timestamp,
    });
  }

  for (const order of activeOrders) {
    const variantId = String(order?.variant_id || '').trim();
    const quantity = Number(order?.quantity || 0);
    if (!variantId || quantity <= 0) continue;

    rows.push({
      id: randomUUID(),
      variant_id: variantId,
      event_type: 'reservation_hold',
      quantity_delta: quantity,
      reference_type: 'order',
      reference_id: String(order.id || ''),
      occurred_at: timestamp,
      metadata: JSON.stringify({ source: 'active_orders_backfill', status: order.status || null }),
      created_at: timestamp,
    });
  }

  return rows;
}
