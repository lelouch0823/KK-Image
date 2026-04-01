import { BadRequestError, NotFoundError } from '../lib/hono/errors.js';
import { CommandIdempotencyRepository } from '../repositories/CommandIdempotencyRepository.js';
import { DomainOutboxRepository } from '../repositories/DomainOutboxRepository.js';
import { PurchaseReceiptRepository } from '../repositories/PurchaseReceiptRepository.js';
import { InventoryService } from './InventoryService.js';
import { getDomainEventDefinition } from './DomainEventCatalog.js';
import { projectOrderLineStatus } from './OrderStatusProjectionService.js';
import {
  buildFinalizeCommandStatements,
  cleanupReservedCommand,
  queryCompatibilityProcurementAggregate,
  replayReservedCommand,
  resolveReservationOwnership,
  requireOrderLine,
} from './order-procurement-shared.js';
import {
  projectCompatibilityProcurementStatus,
  projectPurchaseOrderItemStatus,
  toNonNegativeInt,
} from './purchase-order-projection.js';

function buildReversalFingerprint(poId, receiptId, payload = {}) {
  return JSON.stringify({
    purchase_order_id: poId,
    receipt_id: receiptId,
    reason: payload.reason || null,
  });
}

function isDuplicateReceiptReversalError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('unique constraint failed') &&
    (message.includes('purchase_receipt_reversals.original_receipt_id') ||
      message.includes('idx_purchase_receipt_reversals_original_receipt_unique'))
  );
}

export class OrderProcurementReceiptReversalService {
  constructor(db, deps = {}) {
    this.db = db;
    this.purchaseReceiptRepo = deps.purchaseReceiptRepo || new PurchaseReceiptRepository(db);
    this.inventoryService = deps.inventoryService || new InventoryService(db);
    this.commandIdempotencyRepo =
      deps.commandIdempotencyRepo || new CommandIdempotencyRepository(db, { now: deps.now });
    this.domainOutboxRepo =
      deps.domainOutboxRepo || new DomainOutboxRepository(db, { now: deps.now });
    this.now = deps.now || (() => Date.now());
  }

  async requirePurchaseOrder(poId) {
    const row = await this.db
      .prepare('SELECT id, status FROM purchase_orders WHERE id = ?')
      .bind(poId)
      .first();

    if (!row) throw new NotFoundError('采购单不存在');
    return row;
  }

  async requireReversiblePurchaseOrder(poId) {
    const row = await this.requirePurchaseOrder(poId);
    if (!['ordered', 'shipping', 'arrived'].includes(String(row.status || '').trim())) {
      throw new BadRequestError('仅 ordered、shipping 或 arrived 状态的采购单允许冲销收货');
    }
    return row;
  }

  async requirePurchaseOrderItem(poItemId) {
    const row = await this.db
      .prepare(
        `SELECT id, po_id, quantity, received_qty, cancelled_qty
         FROM purchase_order_items
         WHERE id = ?`
      )
      .bind(poItemId)
      .first();

    if (!row) throw new NotFoundError('采购单明细不存在');
    return row;
  }

  async queryInventoryBalance(variantId) {
    const balance = await this.db
      .prepare(
        `SELECT variant_id, on_hand, reserved, available
         FROM inventory_balances
         WHERE variant_id = ?`
      )
      .bind(variantId)
      .first();

    return {
      variant_id: variantId,
      on_hand: toNonNegativeInt(balance?.on_hand),
      reserved: toNonNegativeInt(balance?.reserved),
      available: toNonNegativeInt(balance?.available),
    };
  }

  async queryPurchaseOrderAggregate(poId) {
    const progress = await this.db
      .prepare(
        `SELECT
            COALESCE(SUM(quantity), 0) AS ordered_qty,
            COALESCE(SUM(received_qty), 0) AS received_qty,
            COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty,
            COALESCE(SUM(MAX(quantity - received_qty - cancelled_qty, 0)), 0) AS outstanding_qty
         FROM purchase_order_items
         WHERE po_id = ?`
      )
      .bind(poId)
      .first();

    return {
      ordered_qty: toNonNegativeInt(progress?.ordered_qty),
      received_qty: toNonNegativeInt(progress?.received_qty),
      cancelled_qty: toNonNegativeInt(progress?.cancelled_qty),
      outstanding_qty: toNonNegativeInt(progress?.outstanding_qty),
    };
  }

  resolveNextPurchaseOrderStatus(currentStatus, nextOutstandingQty) {
    const normalizedStatus = String(currentStatus || '').trim();

    if (normalizedStatus === 'arrived' && toNonNegativeInt(nextOutstandingQty) > 0) {
      return 'shipping';
    }

    return normalizedStatus;
  }

  buildPurchaseOrderStatusTransitionStatement(poId, currentStatus, nextStatus, timestamp) {
    return this.db
      .prepare(
        `UPDATE purchase_orders
         SET status = ?, updated_at = ?
         WHERE id = ? AND status = ?`
      )
      .bind(nextStatus, timestamp, poId, currentStatus);
  }

  buildPurchaseOrderItemReversalStatement(poId, poItem, nextReceivedQty, nextDisplayStatus) {
    return this.db
      .prepare(
        `UPDATE purchase_order_items
         SET received_qty = ?, display_status = ?
         WHERE id = ? AND po_id = ?
           AND received_qty = ?
           AND cancelled_qty = ?`
      )
      .bind(
        nextReceivedQty,
        nextDisplayStatus,
        poItem.id,
        poId,
        toNonNegativeInt(poItem.received_qty),
        toNonNegativeInt(poItem.cancelled_qty)
      );
  }

  buildPurchaseOrderItemRevertStatement(poId, poItem, nextReceivedQty, nextDisplayStatus) {
    return this.db
      .prepare(
        `UPDATE purchase_order_items
         SET received_qty = ?, display_status = ?
         WHERE id = ? AND po_id = ?
           AND received_qty = ?
           AND cancelled_qty = ?
           AND display_status = ?`
      )
      .bind(
        toNonNegativeInt(poItem.received_qty),
        projectPurchaseOrderItemStatus(poItem),
        poItem.id,
        poId,
        nextReceivedQty,
        toNonNegativeInt(poItem.cancelled_qty),
        nextDisplayStatus
      );
  }

  buildOrderLineReversalStatement(orderLine, nextOrderLine, timestamp) {
    return this.db
      .prepare(
        `UPDATE order_lines
         SET received_qty = ?, display_status = ?, updated_at = ?
         WHERE id = ? AND order_id = ?
           AND received_qty = ?
           AND cancelled_qty = ?
           AND ordered_qty = ?
           AND procured_qty = ?
           AND reserved_qty = ?
           AND shipped_qty = ?`
      )
      .bind(
        nextOrderLine.received_qty,
        nextOrderLine.display_status,
        timestamp,
        orderLine.id,
        orderLine.order_id,
        toNonNegativeInt(orderLine.received_qty),
        toNonNegativeInt(orderLine.cancelled_qty),
        toNonNegativeInt(orderLine.ordered_qty),
        toNonNegativeInt(orderLine.procured_qty),
        toNonNegativeInt(orderLine.reserved_qty),
        toNonNegativeInt(orderLine.shipped_qty)
      );
  }

  buildOrderLineRevertStatement(orderLine, nextOrderLine, timestamp) {
    return this.db
      .prepare(
        `UPDATE order_lines
         SET received_qty = ?, display_status = ?, updated_at = ?
         WHERE id = ? AND order_id = ?
           AND received_qty = ?
           AND cancelled_qty = ?
           AND ordered_qty = ?
           AND procured_qty = ?
           AND reserved_qty = ?
           AND shipped_qty = ?
           AND display_status = ?`
      )
      .bind(
        toNonNegativeInt(orderLine.received_qty),
        projectOrderLineStatus(orderLine),
        timestamp,
        orderLine.id,
        orderLine.order_id,
        toNonNegativeInt(nextOrderLine.received_qty),
        toNonNegativeInt(orderLine.cancelled_qty),
        toNonNegativeInt(orderLine.ordered_qty),
        toNonNegativeInt(orderLine.procured_qty),
        toNonNegativeInt(orderLine.reserved_qty),
        toNonNegativeInt(orderLine.shipped_qty),
        nextOrderLine.display_status
      );
  }

  async reverseReceipt(poId, receiptId, payload = {}, options = {}) {
    const purchaseOrder = await this.requireReversiblePurchaseOrder(poId);

    const idempotencyKey = String(options.idempotencyKey || crypto.randomUUID()).trim();
    const requestFingerprint = buildReversalFingerprint(poId, receiptId, payload);
    const reservation = await this.commandIdempotencyRepo.reserveReversalCommand(
      `${poId}:${receiptId}`,
      idempotencyKey,
      requestFingerprint
    );
    const ownsReservation = resolveReservationOwnership(reservation);

    if (reservation?.existing) {
      return replayReservedCommand(reservation, requestFingerprint, {
        mismatchMessage: '同一个幂等键不能提交不同的冲销请求',
        inFlightMessage: '当前幂等键对应的冲销命令仍在处理中',
      });
    }

    const originalReceipt = await this.purchaseReceiptRepo.findReceiptWithLineage(receiptId);
    if (!originalReceipt) throw new NotFoundError('原始收货记录不存在');
    if (originalReceipt.purchase_order_id !== poId) {
      throw new BadRequestError('收货记录不属于当前采购单');
    }

    const reversalQty = toNonNegativeInt(originalReceipt.received_qty);
    if (reversalQty <= 0) {
      throw new BadRequestError('原始收货数量无效，无法冲销');
    }

    const reversalSummary = await this.purchaseReceiptRepo.getReversalSummary(receiptId);
    const reversedQty = toNonNegativeInt(reversalSummary?.reversed_qty);
    if (reversedQty > 0 || toNonNegativeInt(reversalSummary?.reversal_count) > 0) {
      throw new BadRequestError('原始收货记录已冲销，不能重复冲销');
    }
    if (reversedQty + reversalQty > toNonNegativeInt(originalReceipt.received_qty)) {
      throw new BadRequestError('冲销数量超过原始收货数量');
    }

    const inventoryBalance = originalReceipt.variant_id
      ? await this.queryInventoryBalance(originalReceipt.variant_id)
      : null;
    if (inventoryBalance && inventoryBalance.on_hand < reversalQty) {
      throw new BadRequestError('当前库存不足，无法执行收货冲销');
    }

    const poItem = await this.requirePurchaseOrderItem(originalReceipt.purchase_order_item_id);
    const purchaseOrderAggregate = await this.queryPurchaseOrderAggregate(poId);
    const timestamp = this.now();
    const reversalId = crypto.randomUUID();
    const commandRecord = reservation.record;
    const preflightStatements = [];
    const preflightReverts = [];
    const statements = [];
    let sequenceInCommand = 1;
    const nextReceivedQty = Math.max(toNonNegativeInt(poItem.received_qty) - reversalQty, 0);
    const nextDisplayStatus = projectPurchaseOrderItemStatus({
      quantity: poItem.quantity,
      received_qty: nextReceivedQty,
      cancelled_qty: poItem.cancelled_qty,
    });
    const nextOutstandingQty =
      toNonNegativeInt(purchaseOrderAggregate.outstanding_qty) + reversalQty;
    const nextPurchaseOrderStatus = this.resolveNextPurchaseOrderStatus(
      purchaseOrder.status,
      nextOutstandingQty
    );
    const receiptOrderLineId =
      originalReceipt.order_line_id ||
      (originalReceipt.pre_order_id
        ? await this.inventoryService.resolveOrderLineId({
            orderId: originalReceipt.pre_order_id,
            productId: originalReceipt.product_id || null,
            variantId: originalReceipt.variant_id || null,
          })
        : null);

    if (reservation.insertStatement) {
      preflightStatements.push(reservation.insertStatement);
    }
    preflightStatements.push(
      this.buildPurchaseOrderItemReversalStatement(
        poId,
        poItem,
        nextReceivedQty,
        nextDisplayStatus
      )
    );
    preflightReverts.push(
      this.buildPurchaseOrderItemRevertStatement(
        poId,
        poItem,
        nextReceivedQty,
        nextDisplayStatus
      )
    );
    if (nextPurchaseOrderStatus !== purchaseOrder.status) {
      preflightStatements.push(
        this.buildPurchaseOrderStatusTransitionStatement(
          poId,
          purchaseOrder.status,
          nextPurchaseOrderStatus,
          timestamp
        )
      );
      preflightReverts.push(
        this.buildPurchaseOrderStatusTransitionStatement(
          poId,
          nextPurchaseOrderStatus,
          purchaseOrder.status,
          timestamp
        )
      );
    }

    let nextProcurementStatus = null;
    if (receiptOrderLineId && originalReceipt.pre_order_id) {
      const orderLine = await requireOrderLine(
        this.db,
        originalReceipt.pre_order_id,
        receiptOrderLineId
      );
      const nextOrderLineReceivedQty = Math.max(
        toNonNegativeInt(orderLine.received_qty) - reversalQty,
        0
      );
      const nextOrderLine = {
        ...orderLine,
        received_qty: nextOrderLineReceivedQty,
      };
      nextOrderLine.display_status = projectOrderLineStatus(nextOrderLine);
      preflightStatements.push(
        this.buildOrderLineReversalStatement(orderLine, nextOrderLine, timestamp)
      );
      preflightReverts.push(
        this.buildOrderLineRevertStatement(orderLine, nextOrderLine, timestamp)
      );
    }

    const preflightResults = await this.db.batch(preflightStatements);
    const preflightOffset = reservation.insertStatement ? 1 : 0;
    const failedPreflightIndexes = [];
    for (let index = 0; index < preflightReverts.length; index += 1) {
      if ((preflightResults?.[index + preflightOffset]?.meta?.changes || 0) !== 1) {
        failedPreflightIndexes.push(index);
      }
    }

    if (failedPreflightIndexes.length > 0) {
      const successfulReverts = preflightReverts.filter(
        (_statement, index) => !failedPreflightIndexes.includes(index)
      );
      if (successfulReverts.length > 0) {
        await this.db.batch(successfulReverts);
      }
      await cleanupReservedCommand({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        db: this.db,
        ownsReservation,
        commandId: commandRecord.command_id,
      });
      throw new BadRequestError('采购单收货进度已变化，请刷新后重试');
    }

    statements.push(
      this.purchaseReceiptRepo.createReversalInsertStatement({
        id: reversalId,
        original_receipt_id: receiptId,
        purchase_order_id: poId,
        purchase_order_item_id: originalReceipt.purchase_order_item_id,
        reversal_qty: reversalQty,
        reason: payload.reason || null,
        command_id: commandRecord.command_id,
        correlation_id: commandRecord.command_id,
        created_at: timestamp,
      })
    );

    if (receiptOrderLineId && originalReceipt.pre_order_id) {
      const aggregate = await queryCompatibilityProcurementAggregate(
        this.db,
        originalReceipt.pre_order_id
      );
      nextProcurementStatus = projectCompatibilityProcurementStatus(aggregate);

      statements.push(
        this.db
          .prepare(
            `UPDATE orders
           SET procurement_status = ?, updated_at = ?
           WHERE id = ?`
          )
          .bind(nextProcurementStatus, timestamp, originalReceipt.pre_order_id)
      );
    }

    const outboxEvents = [
      {
        id: crypto.randomUUID(),
        command_id: commandRecord.command_id,
        sequence_in_command: sequenceInCommand++,
        event_type: 'purchase_receipt_reversed',
        event_version: 1,
        aggregate_type: 'purchase_receipt_reversal',
        aggregate_id: reversalId,
        correlation_id: commandRecord.command_id,
        causation_id: commandRecord.command_id,
        idempotency_key: `${commandRecord.command_id}:${receiptId}:purchase_receipt_reversed`,
        payload_json: JSON.stringify({
          purchase_order_id: poId,
          purchase_order_item_id: originalReceipt.purchase_order_item_id,
          original_receipt_id: receiptId,
          reversal_id: reversalId,
          reversal_qty: reversalQty,
          order_id: originalReceipt.pre_order_id || null,
        }),
        occurred_at: timestamp,
      },
    ];

    if (originalReceipt.variant_id) {
      const mutation = await this.inventoryService.buildMutationStatements({
        type: 'inventory_adjusted_reversal',
        variantId: originalReceipt.variant_id,
        quantityDelta: -reversalQty,
        orderId: originalReceipt.pre_order_id || null,
        orderLineId: receiptOrderLineId || null,
        purchaseReceiptId: receiptId,
        referenceType: 'purchase_receipt_reversal',
        referenceId: reversalId,
        metadata: {
          purchaseOrderId: poId,
          originalReceiptId: receiptId,
        },
      });
      statements.push(...(mutation?.statements || []));

      outboxEvents.push({
        id: crypto.randomUUID(),
        command_id: commandRecord.command_id,
        sequence_in_command: sequenceInCommand++,
        event_type: 'inventory_receipt_reversed',
        event_version: 1,
        aggregate_type: 'inventory_event',
        aggregate_id: mutation.inventoryEventId || reversalId,
        correlation_id: commandRecord.command_id,
        causation_id: commandRecord.command_id,
        idempotency_key: `${commandRecord.command_id}:${receiptId}:inventory_receipt_reversed`,
        payload_json: JSON.stringify({
          variant_id: originalReceipt.variant_id,
          quantity_delta: -reversalQty,
          original_receipt_id: receiptId,
          reversal_id: reversalId,
        }),
        occurred_at: timestamp,
      });
    }

    if (receiptOrderLineId && originalReceipt.pre_order_id) {
      outboxEvents.push({
        id: crypto.randomUUID(),
        command_id: commandRecord.command_id,
        sequence_in_command: sequenceInCommand++,
        event_type: 'order_procurement_reversed',
        event_version: 1,
        aggregate_type: 'order',
        aggregate_id: originalReceipt.pre_order_id,
        correlation_id: commandRecord.command_id,
        causation_id: commandRecord.command_id,
        idempotency_key: `${commandRecord.command_id}:${receiptId}:order_procurement_reversed`,
        payload_json: JSON.stringify({
          purchase_order_id: poId,
          order_line_id: receiptOrderLineId,
          received_qty_delta: -reversalQty,
          order_procurement_status_after: nextProcurementStatus,
          original_receipt_id: receiptId,
          reversal_id: reversalId,
          reversal_qty: reversalQty,
        }),
        occurred_at: timestamp,
      });
    }

    const response = {
      purchase_order_id: poId,
      receipt_id: receiptId,
      reversal_id: reversalId,
      reversal_qty: reversalQty,
    };

    statements.push(
      ...buildFinalizeCommandStatements({
        db: this.db,
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        purchaseOrderId: poId,
        timestamp,
        commandId: commandRecord.command_id,
        response,
        leadingStatements: this.domainOutboxRepo.buildInsertStatements(
          outboxEvents,
          (event) => getDomainEventDefinition(event.event_type).consumers
        ),
      })
    );

    try {
      await this.db.batch(statements);
      return response;
    } catch (error) {
      if (preflightReverts.length > 0) {
        await this.db.batch(preflightReverts);
      }
      await cleanupReservedCommand({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        db: this.db,
        ownsReservation,
        commandId: commandRecord.command_id,
      });
      if (isDuplicateReceiptReversalError(error)) {
        throw new BadRequestError('原始收货记录已冲销，不能重复冲销');
      }
      throw error;
    }
  }
}
