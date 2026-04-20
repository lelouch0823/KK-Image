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
          order_line_id,
          product_id,
          variant_id,
          receipt_no,
          received_qty,
          note,
          received_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        normalized.id,
        normalized.purchase_order_id,
        normalized.purchase_order_item_id || null,
        normalized.order_line_id || null,
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

  normalizeReversalPayload(payload = {}) {
    if (payload.reversal_qty == null) {
      throw new Error('reversal_qty is required');
    }

    return {
      id: payload.id || crypto.randomUUID(),
      original_receipt_id: payload.original_receipt_id,
      purchase_order_id: payload.purchase_order_id,
      purchase_order_item_id: payload.purchase_order_item_id || null,
      reversal_qty: payload.reversal_qty,
      reason: payload.reason || null,
      command_id: payload.command_id,
      correlation_id: payload.correlation_id,
      created_at: payload.created_at ?? Date.now(),
    };
  }

  createReversalInsertStatement(payload) {
    const normalized = this.normalizeReversalPayload(payload);

    return this.db
      .prepare(
        `INSERT INTO purchase_receipt_reversals (
          id,
          original_receipt_id,
          purchase_order_id,
          purchase_order_item_id,
          reversal_qty,
          reason,
          command_id,
          correlation_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        normalized.id,
        normalized.original_receipt_id,
        normalized.purchase_order_id,
        normalized.purchase_order_item_id,
        normalized.reversal_qty,
        normalized.reason,
        normalized.command_id,
        normalized.correlation_id,
        normalized.created_at
      );
  }

  async createReversal(payload) {
    const normalized = this.normalizeReversalPayload(payload);
    await this.createReversalInsertStatement(normalized).run();
    return normalized;
  }

  async findReceiptWithLineage(receiptId) {
    return this.db
      .prepare(
        `SELECT
            pr.id AS receipt_id,
            pr.purchase_order_id,
            pr.purchase_order_item_id,
            pr.product_id,
            pr.variant_id,
            pr.received_qty,
            poi.pre_order_id,
            COALESCE(pr.order_line_id, poi.order_line_id, ie.order_line_id) AS order_line_id,
            ie.id AS inventory_event_id
         FROM purchase_receipts pr
         LEFT JOIN purchase_order_items poi ON poi.id = pr.purchase_order_item_id
         LEFT JOIN inventory_events ie
           ON ie.purchase_receipt_id = pr.id
          AND ie.event_type = 'purchase_received'
         WHERE pr.id = ?
         LIMIT 1`
      )
      .bind(receiptId)
      .first();
  }

  async getReversalSummary(originalReceiptId) {
    const row = await this.db
      .prepare(
        `SELECT
            COALESCE(SUM(reversal_qty), 0) AS reversed_qty,
            COUNT(*) AS reversal_count
         FROM purchase_receipt_reversals
         WHERE original_receipt_id = ?`
      )
      .bind(originalReceiptId)
      .first();

    return {
      reversed_qty: row?.reversed_qty ?? 0,
      reversal_count: row?.reversal_count ?? 0,
    };
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
