export class PurchaseReceiptRepository {
  constructor(db) {
    this.db = db;
  }

  async create(payload) {
    const id = payload.id || crypto.randomUUID();
    const receivedAt = payload.received_at ?? Date.now();
    const now = payload.created_at ?? Date.now();
    const updatedAt = payload.updated_at ?? now;

    await this.db
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
        id,
        payload.purchase_order_id,
        payload.purchase_order_item_id || null,
        payload.product_id || null,
        payload.variant_id || null,
        payload.receipt_no || null,
        payload.received_qty ?? 0,
        payload.note || null,
        receivedAt,
        now,
        updatedAt
      )
      .run();

    return { id, received_at: receivedAt, created_at: now, updated_at: updatedAt };
  }
}
