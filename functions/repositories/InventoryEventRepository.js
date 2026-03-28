export class InventoryEventRepository {
  constructor(db) {
    this.db = db;
  }

  async create(payload) {
    const id = payload.id || crypto.randomUUID();
    const occurredAt = payload.occurred_at ?? Date.now();
    const now = payload.created_at ?? Date.now();
    const updatedAt = payload.updated_at ?? now;
    const metadata = payload.metadata;
    const metadataJson =
      metadata && typeof metadata !== 'string' ? JSON.stringify(metadata) : metadata || null;

    await this.db
      .prepare(
        `INSERT INTO inventory_events (
          id,
          variant_id,
          order_line_id,
          purchase_receipt_id,
          event_type,
          quantity_delta,
          source_type,
          source_id,
          metadata,
          occurred_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        payload.variant_id || null,
        payload.order_line_id || null,
        payload.purchase_receipt_id || null,
        payload.event_type,
        payload.quantity_delta ?? 0,
        payload.source_type || null,
        payload.source_id || null,
        metadataJson,
        occurredAt,
        now,
        updatedAt
      )
      .run();

    return { id, occurred_at: occurredAt, created_at: now, updated_at: updatedAt };
  }
}
