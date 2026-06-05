/**
 * 库存仓库 (Inventory Repository)
 * =================================
 *
 * 封装 inventory_balances、inventory_ledger、inventory_events 三张表的写操作。
 */
import { generateId } from '../api/utils/id.js';

export class InventoryRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 插入或更新库存余额（库存变动场景：同时调整 on_hand 和 available）
   * @param {string} variantId
   * @param {number} quantityDelta - 正数增加，负数减少
   * @param {number} timestamp
   */
  upsertBalance(variantId, quantityDelta, timestamp) {
    return this.db.prepare(
      `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
       VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(variant_id) DO UPDATE SET
         on_hand = MAX(0, inventory_balances.on_hand + ?),
         available = MAX(0, MAX(0, inventory_balances.on_hand + ?) - inventory_balances.reserved),
         updated_at = excluded.updated_at`
    ).bind(
      variantId,
      Math.max(quantityDelta, 0),
      Math.max(quantityDelta, 0),
      timestamp,
      quantityDelta,
      quantityDelta
    );
  }

  /**
   * 插入或更新库存余额（预留变动场景：仅调整 reserved 和 available）
   * @param {string} variantId
   * @param {number} reservationDelta - 正数预留，负数释放
   * @param {number} timestamp
   */
  upsertReservedBalance(variantId, reservationDelta, timestamp) {
    return this.db.prepare(
      `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
       VALUES (?, 0, ?, 0, ?)
       ON CONFLICT(variant_id) DO UPDATE SET
         reserved = MAX(0, inventory_balances.reserved + ?),
         available = MAX(0, inventory_balances.on_hand - MAX(0, inventory_balances.reserved + ?)),
         updated_at = excluded.updated_at`
    ).bind(
      variantId,
      Math.max(reservationDelta, 0),
      timestamp,
      reservationDelta,
      reservationDelta
    );
  }

  /**
   * 插入库存台账记录
   * @param {Object} params
   * @param {string} params.variantId
   * @param {string} params.eventType
   * @param {number} params.quantityDelta
   * @param {string} params.referenceType
   * @param {string} params.referenceId
   * @param {number} params.occurredAt
   * @param {Object|string} params.metadata
   */
  addLedgerEntry({
    id,
    variantId,
    eventType,
    quantityDelta,
    referenceType,
    referenceId,
    occurredAt,
    metadata,
  }) {
    const ledgerId = id || generateId();
    const timestamp = occurredAt || Date.now();
    const metadataJson = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {});

    return this.db.prepare(
      `INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      ledgerId,
      variantId,
      eventType,
      quantityDelta,
      referenceType,
      referenceId,
      timestamp,
      metadataJson,
      timestamp
    );
  }

  /**
   * 插入库存事件记录
   * @param {Object} params
   * @param {string} params.variantId
   * @param {string|null} params.orderLineId
   * @param {string|null} params.purchaseReceiptId
   * @param {string} params.eventType
   * @param {number} params.quantityDelta
   * @param {string} params.sourceType
   * @param {string} params.sourceId
   * @param {number} params.occurredAt
   * @param {Object|string} params.metadata
   */
  addEvent({
    id,
    variantId,
    orderLineId = null,
    purchaseReceiptId = null,
    eventType,
    quantityDelta,
    sourceType,
    sourceId,
    occurredAt,
    metadata,
  }) {
    const eventId = id || generateId();
    const timestamp = occurredAt || Date.now();
    const metadataJson = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {});

    return this.db.prepare(
      `INSERT INTO inventory_events (
        id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta,
        source_type, source_id, metadata, occurred_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      eventId,
      variantId,
      orderLineId,
      purchaseReceiptId,
      eventType,
      quantityDelta,
      sourceType,
      sourceId,
      metadataJson,
      timestamp,
      timestamp
    );
  }
}
