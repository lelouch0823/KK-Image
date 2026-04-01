import { BadRequestError, NotFoundError } from '../lib/hono/errors.js';
import {
  computePurchaseOrderRemainingReceivable,
  projectPurchaseOrderItemStatus,
  toNonNegativeInt,
} from './purchase-order-projection.js';

const D1_MAX_BATCH_SIZE = 100;

function chunkArray(items = [], chunkSize = D1_MAX_BATCH_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function executeBatchChunks(db, statements = []) {
  const results = [];

  for (const chunk of chunkArray(statements)) {
    const chunkResults = await db.batch(chunk);
    if (Array.isArray(chunkResults)) {
      results.push(...chunkResults);
    }
  }

  return results;
}

function normalizeClosureEntry(entry = {}) {
  return {
    purchase_order_item_id: String(entry.purchase_order_item_id || '').trim(),
    close_qty: toNonNegativeInt(entry.close_qty),
  };
}

export class PurchaseOrderShortageClosureService {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
  }

  async requireClosablePurchaseOrder(poId) {
    if (!poId) throw new BadRequestError('purchase_order_id is required');

    const row = await this.db
      .prepare('SELECT id, status FROM purchase_orders WHERE id = ?')
      .bind(poId)
      .first();

    if (!row) throw new NotFoundError('采购单不存在');
    if (!['ordered', 'shipping'].includes(String(row.status || '').trim())) {
      throw new BadRequestError('仅 ordered 或 shipping 状态的采购单允许关闭待收');
    }

    return row;
  }

  async requirePurchaseOrderItemForPo(poId, purchaseOrderItemId) {
    if (!purchaseOrderItemId) throw new BadRequestError('purchase_order_item_id is required');

    const row = await this.db
      .prepare(
        `SELECT id, po_id, product_id, variant_id, pre_order_id, quantity, received_qty, cancelled_qty
         FROM purchase_order_items
         WHERE id = ?`
      )
      .bind(purchaseOrderItemId)
      .first();

    if (!row) throw new NotFoundError('采购单明细不存在');
    if (row.po_id !== poId) throw new BadRequestError('采购单明细不属于当前采购单');
    return row;
  }

  buildShortageClosureStatement(poId, poItem, nextCancelledQty, displayStatus, closeQty) {
    return this.db
      .prepare(
        `UPDATE purchase_order_items
         SET cancelled_qty = ?, display_status = ?
         WHERE id = ? AND po_id = ?
           AND received_qty = ?
           AND cancelled_qty = ?
           AND COALESCE(quantity, 0) - COALESCE(received_qty, 0) - COALESCE(cancelled_qty, 0) >= ?`
      )
      .bind(
        nextCancelledQty,
        displayStatus,
        poItem.id,
        poId,
        toNonNegativeInt(poItem.received_qty),
        toNonNegativeInt(poItem.cancelled_qty),
        closeQty
      );
  }

  async closeShortages(poId, payload = {}) {
    const items = Array.isArray(payload.items) ? payload.items : null;
    if (!items || items.length === 0) throw new BadRequestError('items is required');

    await this.requireClosablePurchaseOrder(poId);

    const statements = [];
    const revertStatements = [];
    const results = [];
    const seenItemIds = new Set();

    for (const entry of items) {
      const normalizedEntry = normalizeClosureEntry(entry);
      const purchaseOrderItemId = normalizedEntry.purchase_order_item_id;
      const closeQty = normalizedEntry.close_qty;

      if (!purchaseOrderItemId) throw new BadRequestError('purchase_order_item_id is required');
      if (closeQty <= 0) throw new BadRequestError('close_qty must be greater than 0');
      if (seenItemIds.has(purchaseOrderItemId)) {
        throw new BadRequestError('同一条采购明细不能重复关闭待收');
      }
      seenItemIds.add(purchaseOrderItemId);

      const poItem = await this.requirePurchaseOrderItemForPo(poId, purchaseOrderItemId);
      const remainingReceivable = computePurchaseOrderRemainingReceivable(poItem);
      if (closeQty > remainingReceivable) {
        throw new BadRequestError(`关闭数量超过剩余待收数量: ${remainingReceivable}`);
      }

      const nextCancelledQty = toNonNegativeInt(poItem.cancelled_qty) + closeQty;
      const displayStatus = projectPurchaseOrderItemStatus({
        quantity: poItem.quantity,
        received_qty: poItem.received_qty,
        cancelled_qty: nextCancelledQty,
      });
      const remainingReceivableAfter = Math.max(remainingReceivable - closeQty, 0);

      statements.push(
        this.buildShortageClosureStatement(
          poId,
          poItem,
          nextCancelledQty,
          displayStatus,
          closeQty
        )
      );
      revertStatements.push(
        this.db
          .prepare(
            `UPDATE purchase_order_items
             SET cancelled_qty = ?, display_status = ?
             WHERE id = ? AND po_id = ?`
          )
          .bind(
            toNonNegativeInt(poItem.cancelled_qty),
            projectPurchaseOrderItemStatus(poItem),
            poItem.id,
            poId
          )
      );
      results.push({
        purchase_order_item_id: purchaseOrderItemId,
        close_qty: closeQty,
        cancelled_qty_after: nextCancelledQty,
        remaining_receivable_after: remainingReceivableAfter,
        display_status: displayStatus,
      });
    }

    const batchResults = statements.length > 0 ? await executeBatchChunks(this.db, statements) : [];
    const failedIndexes = [];
    for (let index = 0; index < statements.length; index += 1) {
      if ((batchResults[index]?.meta?.changes || 0) !== 1) {
        failedIndexes.push(index);
      }
    }

    if (failedIndexes.length > 0) {
      const successfulReverts = revertStatements.filter(
        (_statement, index) => !failedIndexes.includes(index)
      );
      if (successfulReverts.length > 0) {
        await executeBatchChunks(this.db, successfulReverts);
      }
      throw new BadRequestError('采购单明细待收进度已变化，请刷新后重试');
    }

    await this.db
      .prepare('UPDATE purchase_orders SET updated_at = ? WHERE id = ?')
      .bind(this.now(), poId)
      .run();

    return {
      purchase_order_id: poId,
      closed_count: results.length,
      items: results,
    };
  }
}
