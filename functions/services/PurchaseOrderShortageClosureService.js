import { BadRequestError } from '../lib/hono/errors.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import { CommandIdempotencyRepository } from '../repositories/CommandIdempotencyRepository.js';
import {
  computePurchaseOrderRemainingReceivable,
  projectPurchaseOrderItemStatus,
  toNonNegativeInt,
} from './purchase-order-projection.js';
import {
  buildShortageClosureRequestFingerprint,
  buildPurchaseOrderItemCancelledQtyStatement,
  buildFinalizeCommandStatements,
  cleanupReservedCommand,
  replayReservedCommand,
  resolveReservationOwnership,
  requirePurchaseOrder,
  requirePurchaseOrderItemForPo,
} from './order-procurement-shared.js';

function normalizeClosureEntry(entry = {}) {
  return {
    purchase_order_item_id: String(entry.purchase_order_item_id || '').trim(),
    close_qty: toNonNegativeInt(entry.close_qty),
  };
}

export class PurchaseOrderShortageClosureService {
  constructor(db, deps = {}) {
    this.db = db;
    this.commandIdempotencyRepo =
      deps.commandIdempotencyRepo || new CommandIdempotencyRepository(db, { now: deps.now });
    this.now = deps.now || (() => Date.now());
  }

  async closeShortages(poId, payload = {}, options = {}) {
    const items = Array.isArray(payload.items) ? payload.items : null;
    if (!items || items.length === 0) throw new BadRequestError('items is required');

    await requirePurchaseOrder(this.db, poId, {
      allowedStatuses: ['ordered', 'shipping'],
      invalidStatusMessage: '仅 ordered 或 shipping 状态的采购单允许关闭待收',
    });

    const idempotencyKey = String(options.idempotencyKey || crypto.randomUUID()).trim();
    const requestFingerprint = buildShortageClosureRequestFingerprint(poId, payload);
    const commandReservation = await this.commandIdempotencyRepo.reserveShortageClosureCommand(
      poId,
      idempotencyKey,
      requestFingerprint
    );
    const ownsReservation = resolveReservationOwnership(commandReservation);

    if (commandReservation?.existing) {
      return replayReservedCommand(commandReservation, requestFingerprint, {
        mismatchMessage: '同一个幂等键不能提交不同的关闭待收请求',
        inFlightMessage: '当前幂等键对应的关闭待收命令仍在处理中',
      });
    }

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

      const poItem = await requirePurchaseOrderItemForPo(
        this.db,
        poId,
        purchaseOrderItemId
      );
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
        buildPurchaseOrderItemCancelledQtyStatement(this.db, poId, poItem, {
          nextCancelledQty,
          nextDisplayStatus: displayStatus,
          requiredRemainingQty: closeQty,
        })
      );
      revertStatements.push(
        buildPurchaseOrderItemCancelledQtyStatement(this.db, poId, poItem, {
          nextCancelledQty: toNonNegativeInt(poItem.cancelled_qty),
          nextDisplayStatus: projectPurchaseOrderItemStatus(poItem),
          expectedReceivedQty: poItem.received_qty,
          expectedCancelledQty: nextCancelledQty,
          expectedDisplayStatus: displayStatus,
        })
      );
      results.push({
        purchase_order_item_id: purchaseOrderItemId,
        close_qty: closeQty,
        cancelled_qty_after: nextCancelledQty,
        remaining_receivable_after: remainingReceivableAfter,
        display_status: displayStatus,
      });
    }

    const batchResults = [];
    let appliedStatementCount = 0;
    try {
      for (const chunk of chunkArray(statements)) {
        const chunkResults = await this.db.batch(chunk);
        if (Array.isArray(chunkResults)) {
          batchResults.push(...chunkResults);
        }
        appliedStatementCount += chunk.length;
      }
    } catch (error) {
      const successfulReverts = revertStatements.slice(0, appliedStatementCount);
      if (successfulReverts.length > 0) {
        await executeBatchChunks(this.db, successfulReverts);
      }
      await cleanupReservedCommand({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        db: this.db,
        ownsReservation,
        commandId: commandReservation.record?.command_id,
      });
      throw error;
    }

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
      await cleanupReservedCommand({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        db: this.db,
        ownsReservation,
        commandId: commandReservation.record?.command_id,
      });
      throw new BadRequestError('采购单明细待收进度已变化，请刷新后重试');
    }

    const response = {
      purchase_order_id: poId,
      closed_count: results.length,
      items: results,
    };

    try {
      await executeBatchChunks(
        this.db,
        buildFinalizeCommandStatements({
          db: this.db,
          commandIdempotencyRepo: this.commandIdempotencyRepo,
          purchaseOrderId: poId,
          timestamp: this.now(),
          commandId: commandReservation.record?.command_id,
          response,
        })
      );
    } catch (error) {
      if (revertStatements.length > 0) {
        await executeBatchChunks(this.db, revertStatements);
      }
      await cleanupReservedCommand({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        db: this.db,
        ownsReservation,
        commandId: commandReservation.record?.command_id,
      });
      throw error;
    }

    return response;
  }
}
