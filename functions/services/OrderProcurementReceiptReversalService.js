import { BadRequestError, NotFoundError } from '../lib/hono/errors.js';
import { CommandIdempotencyRepository } from '../repositories/CommandIdempotencyRepository.js';
import { DomainOutboxRepository } from '../repositories/DomainOutboxRepository.js';
import { PurchaseReceiptRepository } from '../repositories/PurchaseReceiptRepository.js';
import { InventoryService } from './InventoryService.js';
import { getDomainEventDefinition } from './DomainEventCatalog.js';
import { projectOrderLineStatus } from './OrderStatusProjectionService.js';
import {
  projectCompatibilityProcurementStatus,
  projectPurchaseOrderItemStatus,
  toNonNegativeInt,
} from './purchase-order-projection.js';

function parseStoredResponse(responseJson) {
  if (!responseJson) return null;
  try {
    return JSON.parse(responseJson);
  } catch {
    return null;
  }
}

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

function buildDeleteCommandStatement(db, commandId) {
  return db.prepare('DELETE FROM command_idempotency WHERE command_id = ?').bind(commandId);
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

  async requireOrderLine(orderId, orderLineId) {
    const row = await this.db
      .prepare(
        `SELECT id, order_id, ordered_qty, procured_qty, received_qty, reserved_qty, shipped_qty, cancelled_qty
         FROM order_lines
         WHERE id = ? AND order_id = ?`
      )
      .bind(orderLineId, orderId)
      .first();

    if (!row) throw new NotFoundError('关联订单行不存在');
    return row;
  }

  async queryCompatibilityProcurementAggregate(orderId) {
    const progress = await this.db
      .prepare(
        `SELECT
            COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
            COALESCE(SUM(procured_qty), 0) AS procured_qty,
            COALESCE(SUM(received_qty), 0) AS received_qty,
            COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
         FROM order_lines
         WHERE order_id = ?`
      )
      .bind(orderId)
      .first();

    return {
      ordered_qty: toNonNegativeInt(progress?.ordered_qty),
      procured_qty: toNonNegativeInt(progress?.procured_qty),
      received_qty: toNonNegativeInt(progress?.received_qty),
      cancelled_qty: toNonNegativeInt(progress?.cancelled_qty),
    };
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

  async reverseReceipt(poId, receiptId, payload = {}, options = {}) {
    await this.requirePurchaseOrder(poId);

    const idempotencyKey = String(options.idempotencyKey || crypto.randomUUID()).trim();
    const requestFingerprint = buildReversalFingerprint(poId, receiptId, payload);
    const reservation = await this.commandIdempotencyRepo.reserveReversalCommand(
      `${poId}:${receiptId}`,
      idempotencyKey,
      requestFingerprint
    );
    const ownsReservation = reservation?.ownsReservation ?? Boolean(reservation?.insertStatement);

    if (reservation?.existing) {
      if (reservation.record?.request_fingerprint !== requestFingerprint) {
        throw new BadRequestError('同一个幂等键不能提交不同的冲销请求');
      }

      const replay = parseStoredResponse(reservation.record?.response_json);
      if (reservation.record?.status === 'committed' && replay) {
        return replay;
      }

      throw new BadRequestError('当前幂等键对应的冲销命令仍在处理中');
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
    const timestamp = this.now();
    const reversalId = crypto.randomUUID();
    const commandRecord = reservation.record;
    const statements = [];
    let sequenceInCommand = 1;

    if (reservation.insertStatement) {
      statements.push(reservation.insertStatement);
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

    const nextReceivedQty = Math.max(toNonNegativeInt(poItem.received_qty) - reversalQty, 0);
    const nextDisplayStatus = projectPurchaseOrderItemStatus({
      quantity: poItem.quantity,
      received_qty: nextReceivedQty,
      cancelled_qty: poItem.cancelled_qty,
    });
    statements.push(
      this.db
        .prepare(
          `UPDATE purchase_order_items
         SET received_qty = ?, display_status = ?
         WHERE id = ? AND po_id = ?`
        )
        .bind(nextReceivedQty, nextDisplayStatus, poItem.id, poId)
    );

    let nextProcurementStatus = null;
    if (originalReceipt.order_line_id && originalReceipt.pre_order_id) {
      const orderLine = await this.requireOrderLine(
        originalReceipt.pre_order_id,
        originalReceipt.order_line_id
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
      statements.push(
        this.db
          .prepare(
            `UPDATE order_lines
           SET received_qty = ?, display_status = ?, updated_at = ?
           WHERE id = ? AND order_id = ?`
          )
          .bind(
            nextOrderLineReceivedQty,
            nextOrderLine.display_status,
            timestamp,
            originalReceipt.order_line_id,
            originalReceipt.pre_order_id
          )
      );

      const aggregate = await this.queryCompatibilityProcurementAggregate(
        originalReceipt.pre_order_id
      );
      nextProcurementStatus = projectCompatibilityProcurementStatus({
        ...aggregate,
        received_qty: Math.max(toNonNegativeInt(aggregate.received_qty) - reversalQty, 0),
      });
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
        orderLineId: originalReceipt.order_line_id || null,
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

    if (originalReceipt.order_line_id && originalReceipt.pre_order_id) {
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
          order_line_id: originalReceipt.order_line_id,
          received_qty_delta: -reversalQty,
          order_procurement_status_after: nextProcurementStatus,
          original_receipt_id: receiptId,
          reversal_id: reversalId,
          reversal_qty: reversalQty,
        }),
        occurred_at: timestamp,
      });
    }

    statements.push(
      ...this.domainOutboxRepo.buildInsertStatements(
        outboxEvents,
        (event) => getDomainEventDefinition(event.event_type).consumers
      )
    );

    const response = {
      purchase_order_id: poId,
      receipt_id: receiptId,
      reversal_id: reversalId,
      reversal_qty: reversalQty,
    };

    statements.push(
      this.db
        .prepare('UPDATE purchase_orders SET updated_at = ? WHERE id = ?')
        .bind(timestamp, poId)
    );
    statements.push(
      this.commandIdempotencyRepo.buildFinalizeStatement(
        commandRecord.command_id,
        response,
        'committed'
      )
    );

    try {
      await this.db.batch(statements);
      return response;
    } catch (error) {
      if (ownsReservation) {
        const deleteStatement =
          this.commandIdempotencyRepo.buildDeleteStatement?.(commandRecord.command_id) ||
          buildDeleteCommandStatement(this.db, commandRecord.command_id);
        await deleteStatement.run();
      }
      if (isDuplicateReceiptReversalError(error)) {
        throw new BadRequestError('原始收货记录已冲销，不能重复冲销');
      }
      throw error;
    }
  }
}
