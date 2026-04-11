import { BadRequestError } from '../lib/hono/errors.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import { CommandIdempotencyRepository } from '../repositories/CommandIdempotencyRepository.js';
import {
  computePurchaseOrderRemainingReceivable,
  projectCompatibilityProcurementStatus,
  projectPurchaseOrderItemStatus,
  toNonNegativeInt,
} from './purchase-order-projection.js';
import {
  buildCompatibilityOrderProcurementStatusStatement,
  buildOrderLineProjectionStatement,
  buildShortageClosureRequestFingerprint,
  buildPurchaseOrderItemCancelledQtyStatement,
  buildFinalizeCommandStatements,
  cleanupReservedCommand,
  queryCompatibilityProcurementAggregate,
  replayReservedCommand,
  resolveReservationOwnership,
  requirePurchaseOrder,
  requirePurchaseOrderItemForPo,
} from './order-procurement-shared.js';
import { projectOrderLineStatus } from './OrderStatusProjectionService.js';

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

  async queryCompatibilityOrderLines(
    orderId,
    { productId = null, variantId = null } = {},
    includeScopedFilters = true
  ) {
    if (!orderId) return [];

    const filters = ['order_id = ?'];
    const params = [orderId];

    if (includeScopedFilters && variantId) {
      filters.push('variant_id = ?');
      params.push(variantId);
    }
    if (includeScopedFilters && productId) {
      filters.push('product_id = ?');
      params.push(productId);
    }

    const { results } = await this.db
      .prepare(
        `SELECT id, order_id, product_id, variant_id, ordered_qty, procured_qty, received_qty, reserved_qty, shipped_qty, cancelled_qty
         FROM order_lines
         WHERE ${filters.join(' AND ')}
         ORDER BY created_at ASC
         LIMIT 2`
      )
      .bind(...params)
      .all();

    return results || [];
  }

  async resolveCompatibilityOrderLine(orderId, criteria = {}) {
    if (!orderId) return null;

    const scopedMatches = await this.queryCompatibilityOrderLines(orderId, criteria, true);
    if (scopedMatches.length === 1) return scopedMatches[0];
    if (scopedMatches.length > 1) {
      throw new BadRequestError('无法确定关联的订单行，请刷新后重试');
    }

    if (criteria?.productId || criteria?.variantId) {
      const fallbackMatches = await this.queryCompatibilityOrderLines(orderId, criteria, false);
      if (fallbackMatches.length === 1) return fallbackMatches[0];
      if (fallbackMatches.length > 1) {
        throw new BadRequestError('无法确定关联的订单行，请刷新后重试');
      }
    }

    return null;
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
    const orderStatements = [];
    const orderReverts = [];
    const orderLineTransitions = new Map();
    const orderAggregateTransitions = new Map();
    const results = [];
    const changedOrderStatuses = [];
    const seenItemIds = new Set();
    const timestamp = this.now();

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

      if (poItem.pre_order_id) {
        const compatibilityOrderLine = await this.resolveCompatibilityOrderLine(poItem.pre_order_id, {
          productId: poItem.product_id || null,
          variantId: poItem.variant_id || null,
        });
        if (!compatibilityOrderLine) {
          throw new BadRequestError('关联订单缺少唯一可投影的订单行');
        }

        const existingLineTransition = orderLineTransitions.get(compatibilityOrderLine.id);
        const currentLineState = existingLineTransition?.next || compatibilityOrderLine;
        const nextLineState = {
          ...currentLineState,
          procured_qty: Math.max(
            toNonNegativeInt(currentLineState.received_qty),
            toNonNegativeInt(currentLineState.procured_qty) - closeQty
          ),
        };
        nextLineState.display_status = projectOrderLineStatus(nextLineState);
        orderLineTransitions.set(compatibilityOrderLine.id, {
          current: existingLineTransition?.current || compatibilityOrderLine,
          next: nextLineState,
        });

        const aggregateTransition = orderAggregateTransitions.get(poItem.pre_order_id) || {
          current: await queryCompatibilityProcurementAggregate(this.db, poItem.pre_order_id),
          next: await queryCompatibilityProcurementAggregate(this.db, poItem.pre_order_id),
        };
        const procuredDelta = Math.max(
          toNonNegativeInt(currentLineState.procured_qty) -
            toNonNegativeInt(nextLineState.procured_qty),
          0
        );
        aggregateTransition.next = {
          ...aggregateTransition.next,
          procured_qty: Math.max(
            toNonNegativeInt(aggregateTransition.next.procured_qty) - procuredDelta,
            0
          ),
        };
        orderAggregateTransitions.set(poItem.pre_order_id, aggregateTransition);
      }

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

    for (const transition of orderLineTransitions.values()) {
      orderStatements.push(
        buildOrderLineProjectionStatement(this.db, transition.next, transition.current, timestamp, {
          guardProjectionState: true,
        })
      );
      orderReverts.unshift(
        buildOrderLineProjectionStatement(this.db, transition.current, transition.next, timestamp, {
          guardProjectionState: true,
          expectedDisplayStatus: transition.next.display_status,
        })
      );
    }

    for (const [orderId, transition] of orderAggregateTransitions.entries()) {
      const previousStatus = projectCompatibilityProcurementStatus(transition.current);
      const nextStatus = projectCompatibilityProcurementStatus(transition.next);
      if (nextStatus === previousStatus) continue;

      orderStatements.push(
        buildCompatibilityOrderProcurementStatusStatement(
          this.db,
          orderId,
          nextStatus,
          timestamp,
          {
            excludeTerminalStatuses: true,
            requireStatusChange: true,
          }
        )
      );
      orderReverts.unshift(
        buildCompatibilityOrderProcurementStatusStatement(
          this.db,
          orderId,
          previousStatus,
          timestamp,
          {
            excludeTerminalStatuses: true,
          }
        )
      );
      changedOrderStatuses.push({
        orderId,
        procurementStatus: nextStatus,
      });
    }

    if (orderStatements.length > 0) {
      const orderBatchResults = await this.db.batch(orderStatements);
      const failedOrderIndexes = [];
      for (let index = 0; index < orderStatements.length; index += 1) {
        if ((orderBatchResults[index]?.meta?.changes || 0) !== 1) {
          failedOrderIndexes.push(index);
        }
      }

      if (failedOrderIndexes.length > 0) {
        const successfulOrderReverts = orderReverts.filter(
          (_statement, index) => !failedOrderIndexes.includes(index)
        );
        const rollbackStatements = [...successfulOrderReverts, ...revertStatements];
        if (rollbackStatements.length > 0) {
          await executeBatchChunks(this.db, rollbackStatements);
        }
        await cleanupReservedCommand({
          commandIdempotencyRepo: this.commandIdempotencyRepo,
          db: this.db,
          ownsReservation,
          commandId: commandReservation.record?.command_id,
        });
        throw new BadRequestError('关联订单采购进度已变化，请刷新后重试');
      }
    }

    const response = {
      purchase_order_id: poId,
      closed_count: results.length,
      items: results,
      changedOrderStatuses,
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
      if (orderReverts.length > 0 || revertStatements.length > 0) {
        await executeBatchChunks(this.db, [...orderReverts, ...revertStatements]);
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
