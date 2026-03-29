export class PurchaseReceiptRepository {
  constructor(db) {
    this.db = db;
  }

  normalizePayload(payload = {}) {
    if (payload.received_qty == null) {
      throw new Error('received_qty is required');
    }

    const id = payload.id || crypto.randomUUID();
    const receivedAt = payload.received_at ?? Date.now();
    const now = payload.created_at ?? Date.now();
    const updatedAt = payload.updated_at ?? now;

    return {
      ...payload,
      id,
      received_at: receivedAt,
      created_at: now,
      updated_at: updatedAt,
    };
  }

  createInsertStatement(payload) {
    const normalized = this.normalizePayload(payload);

    return this.db
      .prepare(
        `INSERT INTO purchase_receipts (
          id,
          purchase_order_id,
          purchase_order_item_id,
          product_id,
          variant_id,
          receipt_no,
          received_qty,
          note,
          received_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        normalized.id,
        normalized.purchase_order_id,
        normalized.purchase_order_item_id || null,
        normalized.product_id || null,
        normalized.variant_id || null,
        normalized.receipt_no || null,
        normalized.received_qty,
        normalized.note || null,
        normalized.received_at,
        normalized.created_at,
        normalized.updated_at
      );
  }

  async create(payload) {
    const normalized = this.normalizePayload(payload);
    const statement = this.createInsertStatement(normalized);
    await statement.run();

    return {
      id: normalized.id,
      received_at: normalized.received_at,
      created_at: normalized.created_at,
      updated_at: normalized.updated_at,
    };
  }
}
