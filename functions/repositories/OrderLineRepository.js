export class OrderLineRepository {
  constructor(db) {
    this.db = db;
  }

  async create(payload) {
    const id = payload.id || crypto.randomUUID();
    const timestamp = payload.created_at ?? Date.now();
    const updatedAt = payload.updated_at ?? timestamp;
    const snapshotSpecs = payload.snapshot_specs;
    const snapshotSpecsJson =
      snapshotSpecs && typeof snapshotSpecs !== 'string'
        ? JSON.stringify(snapshotSpecs)
        : snapshotSpecs || null;

    await this.db
      .prepare(
        `INSERT INTO order_lines (
          id,
          order_id,
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
          display_status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        payload.order_id,
        payload.product_id || null,
        payload.variant_id || null,
        payload.snapshot_name,
        payload.snapshot_sku || null,
        snapshotSpecsJson,
        payload.snapshot_image || null,
        payload.ordered_qty ?? 0,
        payload.procured_qty ?? 0,
        payload.received_qty ?? 0,
        payload.reserved_qty ?? 0,
        payload.shipped_qty ?? 0,
        payload.cancelled_qty ?? 0,
        payload.display_status || 'unprocured',
        timestamp,
        updatedAt
      )
      .run();

    return { id, created_at: timestamp, updated_at: updatedAt };
  }
}
