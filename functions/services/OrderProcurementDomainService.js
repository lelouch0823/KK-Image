import { BadRequestError, NotFoundError } from '../lib/hono/errors.js';
import { CommandIdempotencyRepository } from '../repositories/CommandIdempotencyRepository.js';
import { DomainOutboxRepository } from '../repositories/DomainOutboxRepository.js';
import { PurchaseReceiptRepository } from '../repositories/PurchaseReceiptRepository.js';
import { executeBatchChunks } from '../lib/db/batch.js';
import { InventoryService } from './InventoryService.js';
import { getDomainEventDefinition } from './DomainEventCatalog.js';
import { projectOrderLineStatus } from './OrderStatusProjectionService.js';
import {
  buildDeleteCommandStatement,
  parseStoredResponse,
  queryCompatibilityProcurementAggregate,
  requireOrderLine,
} from './order-procurement-shared.js';
import {
  computePurchaseOrderRemainingReceivable as computeRemainingReceivable,
  projectCompatibilityProcurementStatus,
  projectPurchaseOrderItemStatus,
  toNonNegativeInt,
} from './purchase-order-projection.js';

const D1_MAX_BATCH_SIZE = 100;
const RECEIPT_FINALIZE_STATEMENT_COUNT = 2;
const RECEIPT_BASE_EVENT_WRITE_COUNT =
  1 + getDomainEventDefinition('purchase_receipt_recorded').consumers.length;
const RECEIPT_INVENTORY_EVENT_WRITE_COUNT =
  1 + getDomainEventDefinition('inventory_received').consumers.length;
const RECEIPT_ORDER_EVENT_WRITE_COUNT =
  1 + getDomainEventDefinition('order_procurement_progressed').consumers.length;

function normalizeReceiptEntry(entry = {}) {
  return {
    purchase_order_item_id: String(entry.purchase_order_item_id || '').trim(),
    received_qty: toNonNegativeInt(entry.received_qty),
    note: entry.note == null ? null : String(entry.note),
  };
}

function buildReceiptRequestFingerprint(poId, payload = {}) {
  const normalizedItems = (Array.isArray(payload.items) ? payload.items : [])
    .map(normalizeReceiptEntry)
    .sort((left, right) => {
      const key = left.purchase_order_item_id.localeCompare(right.purchase_order_item_id);
      if (key !== 0) return key;
      const qty = left.received_qty - right.received_qty;
      if (qty !== 0) return qty;
      return String(left.note || '').localeCompare(String(right.note || ''));
    });

  return JSON.stringify({
    purchase_order_id: poId,
    items: normalizedItems,
  });
}

function countReceiptWriteStatements(preparedReceipts = []) {
  return preparedReceipts.reduce(
    (total, prepared) => {
      let nextTotal = total + 1 + RECEIPT_BASE_EVENT_WRITE_COUNT;

      if (prepared.compatibilityOrderLineId && prepared.poItem?.pre_order_id) {
        nextTotal += 2 + RECEIPT_ORDER_EVENT_WRITE_COUNT;
      }

      if (prepared.poItem?.variant_id) {
        nextTotal += 4 + RECEIPT_INVENTORY_EVENT_WRITE_COUNT;
      }

      return nextTotal;
    },
    RECEIPT_FINALIZE_STATEMENT_COUNT
  );
}

export class OrderProcurementDomainService {
  /**
   * @param {D1Database} db
   * @param {object} deps
   * @param {PurchaseReceiptRepository} deps.purchaseReceiptRepo
   * @param {InventoryService} deps.inventoryService
   * @param {CommandIdempotencyRepository} deps.commandIdempotencyRepo
   * @param {DomainOutboxRepository} deps.domainOutboxRepo
   * @param {() => number} deps.now
   */
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

  async requireReceivablePurchaseOrder(poId) {
    if (!poId) throw new BadRequestError('purchase_order_id is required');

    const row = await this.db
      .prepare('SELECT id, status FROM purchase_orders WHERE id = ?')
      .bind(poId)
      .first();

    if (!row) throw new NotFoundError('采购单不存在');
    if (!['ordered', 'shipping'].includes(String(row.status || '').trim())) {
      throw new BadRequestError('仅 ordered 或 shipping 状态的采购单允许收货');
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
      throw new BadRequestError('无法确定关联的订单行，请提供 orderLineId');
    }

    if (criteria?.productId || criteria?.variantId) {
      const fallbackMatches = await this.queryCompatibilityOrderLines(orderId, criteria, false);
      if (fallbackMatches.length === 1) return fallbackMatches[0];
      if (fallbackMatches.length > 1) {
        throw new BadRequestError('无法确定关联的订单行，请提供 orderLineId');
      }
    }

    return null;
  }

  async updateCompatibilityOrderLineProgress(orderLine, receivedDelta) {
    if (!orderLine?.id || !orderLine?.order_id) return null;
    const safeDelta = toNonNegativeInt(receivedDelta);
    if (safeDelta <= 0) return null;

    const ordered = toNonNegativeInt(orderLine.ordered_qty);
    const next = {
      ordered_qty: ordered,
      procured_qty: Math.max(toNonNegativeInt(orderLine.procured_qty), ordered),
      received_qty: Math.min(toNonNegativeInt(orderLine.received_qty) + safeDelta, ordered),
      reserved_qty: toNonNegativeInt(orderLine.reserved_qty),
      shipped_qty: toNonNegativeInt(orderLine.shipped_qty),
      cancelled_qty: toNonNegativeInt(orderLine.cancelled_qty),
    };
    next.display_status = projectOrderLineStatus(next);

    const timestamp = this.now();
    await this.db
      .prepare(
        `UPDATE order_lines
         SET ordered_qty = ?,
             procured_qty = ?,
             received_qty = ?,
             reserved_qty = ?,
             shipped_qty = ?,
             cancelled_qty = ?,
             display_status = ?,
             updated_at = ?
         WHERE id = ? AND order_id = ?`
      )
      .bind(
        next.ordered_qty,
        next.procured_qty,
        next.received_qty,
        next.reserved_qty,
        next.shipped_qty,
        next.cancelled_qty,
        next.display_status,
        timestamp,
        orderLine.id,
        orderLine.order_id
      )
      .run();

    return next;
  }

  async syncCompatibilityProcurementStatus(orderId) {
    if (!orderId) return null;

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

    const nextStatus = projectCompatibilityProcurementStatus(progress || {});
    const timestamp = this.now();
    await this.db
      .prepare(
        `UPDATE orders
         SET procurement_status = ?, updated_at = ?
         WHERE id = ?
           AND status NOT IN ('delivered', 'void')
           AND COALESCE(procurement_status, 'none') != ?`
      )
      .bind(nextStatus, timestamp, orderId, nextStatus)
      .run();

    return nextStatus;
  }

  async queryInventoryBalance(variantId) {
    if (!variantId) return null;

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

  buildPurchaseOrderItemReceiptStatement(poId, poItem, nextReceived, displayStatus, receivedQty) {
    return this.db
      .prepare(
        `UPDATE purchase_order_items
         SET received_qty = ?, display_status = ?
         WHERE id = ? AND po_id = ?
           AND received_qty = ?
           AND cancelled_qty = ?
           AND COALESCE(quantity, 0) - COALESCE(received_qty, 0) - COALESCE(cancelled_qty, 0) >= ?`
      )
      .bind(
        nextReceived,
        displayStatus,
        poItem.id,
        poId,
        toNonNegativeInt(poItem.received_qty),
        toNonNegativeInt(poItem.cancelled_qty),
        receivedQty
      );
  }

  buildOrderLineProgressStatement(orderLine, timestamp) {
    return this.db
      .prepare(
        `UPDATE order_lines
         SET ordered_qty = ?,
             procured_qty = ?,
             received_qty = ?,
             reserved_qty = ?,
             shipped_qty = ?,
             cancelled_qty = ?,
             display_status = ?,
             updated_at = ?
         WHERE id = ? AND order_id = ?`
      )
      .bind(
        orderLine.ordered_qty,
        orderLine.procured_qty,
        orderLine.received_qty,
        orderLine.reserved_qty,
        orderLine.shipped_qty,
        orderLine.cancelled_qty,
        orderLine.display_status,
        timestamp,
        orderLine.id,
        orderLine.order_id
      );
  }

  buildCompatibilityOrderStatusStatement(orderId, procurementStatus, timestamp) {
    return this.db
      .prepare(
        `UPDATE orders
         SET procurement_status = ?, updated_at = ?
         WHERE id = ?
           AND status NOT IN ('delivered', 'void')
           AND COALESCE(procurement_status, 'none') != ?`
      )
      .bind(procurementStatus, timestamp, orderId, procurementStatus);
  }

  async recordPurchaseOrderReceipts(poId, payload = {}, options = {}) {
    const items = Array.isArray(payload.items) ? payload.items : null;
    if (!items || items.length === 0) throw new BadRequestError('items is required');
    await this.requireReceivablePurchaseOrder(poId);

    const idempotencyKey = String(options.idempotencyKey || crypto.randomUUID()).trim();
    const requestFingerprint = buildReceiptRequestFingerprint(poId, payload);
    const commandReservation = await this.commandIdempotencyRepo.reserveReceiptCommand(
      poId,
      idempotencyKey,
      requestFingerprint
    );
    const ownsReservation =
      commandReservation?.ownsReservation ?? Boolean(commandReservation?.insertStatement);

    if (commandReservation?.existing) {
      if (commandReservation.record?.request_fingerprint !== requestFingerprint) {
        throw new BadRequestError('同一个幂等键不能提交不同的收货请求');
      }

      const replay = parseStoredResponse(commandReservation.record?.response_json);
      if (commandReservation.record?.status === 'committed' && replay) {
        return replay;
      }

      throw new BadRequestError('当前幂等键对应的收货命令仍在处理中');
    }

    const timestamp = this.now();
    const commandRecord = commandReservation.record;
    const orderLineStates = new Map();
    const orderAggregateStates = new Map();
    const inventoryStates = new Map();
    const statements = [];
    const results = [];
    const outboxEvents = [];
    const preflightStatements = [];
    const preflightReverts = [];
    const preparedReceipts = [];
    let sequenceInCommand = 1;

    if (commandReservation.insertStatement) {
      preflightStatements.push(commandReservation.insertStatement);
    }

    for (const entry of items) {
      const normalizedEntry = normalizeReceiptEntry(entry);
      const purchaseOrderItemId = normalizedEntry.purchase_order_item_id;
      const receivedQty = normalizedEntry.received_qty;
      if (!purchaseOrderItemId) throw new BadRequestError('purchase_order_item_id is required');
      if (receivedQty <= 0) throw new BadRequestError('received_qty must be greater than 0');

      const poItem = await this.requirePurchaseOrderItemForPo(poId, purchaseOrderItemId);
      const remainingReceivable = computeRemainingReceivable(poItem);
      if (receivedQty > remainingReceivable) {
        throw new BadRequestError(`收货数量超过剩余可收数量: ${remainingReceivable}`);
      }

      const compatibilityOrderLine = poItem.pre_order_id
        ? await this.resolveCompatibilityOrderLine(poItem.pre_order_id, {
            productId: poItem.product_id || null,
            variantId: poItem.variant_id || null,
          })
        : null;
      if (!compatibilityOrderLine && poItem.pre_order_id) {
        throw new BadRequestError('关联订单缺少唯一可投影的订单行');
      }

      const nextReceived = toNonNegativeInt(poItem.received_qty) + receivedQty;
      const displayStatus = projectPurchaseOrderItemStatus({
        quantity: poItem.quantity,
        received_qty: nextReceived,
        cancelled_qty: poItem.cancelled_qty,
      });

      const purchaseItemStatement = this.buildPurchaseOrderItemReceiptStatement(
        poId,
        poItem,
        nextReceived,
        displayStatus,
        receivedQty
      );
      preflightReverts.push(
        this.db
          .prepare(
            `UPDATE purchase_order_items
           SET received_qty = ?, display_status = ?
           WHERE id = ? AND po_id = ?`
          )
          .bind(
            toNonNegativeInt(poItem.received_qty),
            projectPurchaseOrderItemStatus(poItem),
            poItem.id,
            poId
          )
      );
      preflightStatements.push(purchaseItemStatement);
      preparedReceipts.push({
        normalizedEntry,
        purchaseOrderItemId,
        receivedQty,
        poItem,
        compatibilityOrderLineId: compatibilityOrderLine?.id || null,
        nextReceived,
        displayStatus,
      });
    }

    if (countReceiptWriteStatements(preparedReceipts) > D1_MAX_BATCH_SIZE) {
      if (ownsReservation) {
        const deleteStatement =
          this.commandIdempotencyRepo.buildDeleteStatement?.(commandRecord.command_id) ||
          buildDeleteCommandStatement(this.db, commandRecord.command_id);
        await deleteStatement.run();
      }
      throw new BadRequestError('本次收货包含的写入过多，请拆分后重试');
    }

    const preflightResults =
      preflightStatements.length > 0 ? await executeBatchChunks(this.db, preflightStatements) : [];
    const preflightOffset = commandReservation.insertStatement ? 1 : 0;
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
        await executeBatchChunks(this.db, successfulReverts);
      }
      if (ownsReservation) {
        const deleteStatement =
          this.commandIdempotencyRepo.buildDeleteStatement?.(commandRecord.command_id) ||
          buildDeleteCommandStatement(this.db, commandRecord.command_id);
        await deleteStatement.run();
      }
      throw new BadRequestError('采购单明细收货进度已变化，请刷新后重试');
    }

    try {
      for (const prepared of preparedReceipts) {
        const {
          normalizedEntry,
          purchaseOrderItemId,
          receivedQty,
          poItem,
          compatibilityOrderLineId,
          nextReceived,
          displayStatus,
        } = prepared;

        const compatibilityOrderLine =
          compatibilityOrderLineId && poItem.pre_order_id
            ? await requireOrderLine(this.db, poItem.pre_order_id, compatibilityOrderLineId)
            : null;

        const receiptId = crypto.randomUUID();
        const receiptPayload = {
          id: receiptId,
          purchase_order_id: poId,
          purchase_order_item_id: purchaseOrderItemId,
          order_line_id: compatibilityOrderLine?.id || null,
          product_id: poItem.product_id || null,
          variant_id: poItem.variant_id || null,
          received_qty: receivedQty,
          note: normalizedEntry.note,
          received_at: timestamp,
          created_at: timestamp,
          updated_at: timestamp,
        };
        statements.push(this.purchaseReceiptRepo.createInsertStatement(receiptPayload));

        outboxEvents.push({
          id: crypto.randomUUID(),
          command_id: commandRecord.command_id,
          sequence_in_command: sequenceInCommand++,
          event_type: 'purchase_receipt_recorded',
          event_version: 1,
          aggregate_type: 'purchase_receipt',
          aggregate_id: receiptId,
          correlation_id: commandRecord.command_id,
          causation_id: options.causationId || commandRecord.command_id,
          idempotency_key: `${commandRecord.command_id}:${purchaseOrderItemId}:purchase_receipt_recorded:${sequenceInCommand - 1}`,
          payload_json: JSON.stringify({
            purchase_order_id: poId,
            purchase_order_item_id: purchaseOrderItemId,
            product_id: poItem.product_id || null,
            variant_id: poItem.variant_id || null,
            order_id: poItem.pre_order_id || null,
            order_line_id: compatibilityOrderLine?.id || null,
            receipt_id: receiptId,
            received_qty: receivedQty,
            purchase_item_received_qty_after: nextReceived,
            purchase_item_display_status_after: displayStatus,
          }),
          occurred_at: timestamp,
        });

        if (compatibilityOrderLine) {
          const currentLineState = orderLineStates.get(compatibilityOrderLine.id) || {
            ...compatibilityOrderLine,
            ordered_qty: toNonNegativeInt(compatibilityOrderLine.ordered_qty),
            procured_qty: toNonNegativeInt(compatibilityOrderLine.procured_qty),
            received_qty: toNonNegativeInt(compatibilityOrderLine.received_qty),
            reserved_qty: toNonNegativeInt(compatibilityOrderLine.reserved_qty),
            shipped_qty: toNonNegativeInt(compatibilityOrderLine.shipped_qty),
            cancelled_qty: toNonNegativeInt(compatibilityOrderLine.cancelled_qty),
          };
          const nextLineState = {
            ...currentLineState,
            procured_qty: Math.max(currentLineState.procured_qty, currentLineState.ordered_qty),
            received_qty: Math.min(
              currentLineState.received_qty + receivedQty,
              currentLineState.ordered_qty
            ),
          };
          nextLineState.display_status = projectOrderLineStatus(nextLineState);
          orderLineStates.set(nextLineState.id, nextLineState);
          statements.push(this.buildOrderLineProgressStatement(nextLineState, timestamp));

          const currentAggregate =
            orderAggregateStates.get(poItem.pre_order_id) ||
            (await queryCompatibilityProcurementAggregate(this.db, poItem.pre_order_id));
          const nextAggregate = {
            ...currentAggregate,
            procured_qty:
              toNonNegativeInt(currentAggregate.procured_qty) +
              Math.max(nextLineState.procured_qty - currentLineState.procured_qty, 0),
            received_qty:
              toNonNegativeInt(currentAggregate.received_qty) +
              Math.max(nextLineState.received_qty - currentLineState.received_qty, 0),
          };
          orderAggregateStates.set(poItem.pre_order_id, nextAggregate);

          const nextProcurementStatus = projectCompatibilityProcurementStatus(nextAggregate);
          statements.push(
            this.buildCompatibilityOrderStatusStatement(
              poItem.pre_order_id,
              nextProcurementStatus,
              timestamp
            )
          );

          orderLineStates.set(`${nextLineState.id}:outbox`, {
            nextProcurementStatus,
            nextLineState,
          });
        }

        if (poItem.variant_id) {
          const currentInventory =
            inventoryStates.get(poItem.variant_id) ||
            (await this.queryInventoryBalance(poItem.variant_id));
          const nextInventory = {
            ...currentInventory,
            on_hand: toNonNegativeInt(currentInventory?.on_hand) + receivedQty,
            available: toNonNegativeInt(currentInventory?.available) + receivedQty,
          };
          inventoryStates.set(poItem.variant_id, nextInventory);

          const inventoryMutation = await this.inventoryService.buildMutationStatements({
            type: 'purchase_received',
            variantId: poItem.variant_id,
            quantityDelta: receivedQty,
            orderId: poItem.pre_order_id || null,
            orderLineId: compatibilityOrderLine?.id || null,
            purchaseReceiptId: receiptId,
            referenceType: 'purchase_receipt',
            referenceId: receiptId,
            metadata: {
              purchaseOrderId: poId,
              purchaseOrderItemId,
            },
          });
          statements.push(...(inventoryMutation?.statements || []));

          outboxEvents.push({
            id: crypto.randomUUID(),
            command_id: commandRecord.command_id,
            sequence_in_command: sequenceInCommand++,
            event_type: 'inventory_received',
            event_version: 1,
            aggregate_type: 'inventory_event',
            aggregate_id: inventoryMutation.inventoryEventId || receiptId,
            correlation_id: commandRecord.command_id,
            causation_id: options.causationId || commandRecord.command_id,
            idempotency_key: `${commandRecord.command_id}:${inventoryMutation.inventoryEventId || receiptId}:inventory_received`,
            payload_json: JSON.stringify({
              variant_id: poItem.variant_id,
              quantity_delta: receivedQty,
              purchase_receipt_id: receiptId,
              on_hand_after: nextInventory.on_hand,
              available_after: nextInventory.available,
            }),
            occurred_at: timestamp,
          });
        }

        const orderProjection = compatibilityOrderLine
          ? orderLineStates.get(`${compatibilityOrderLine.id}:outbox`)
          : null;
        if (orderProjection) {
          outboxEvents.push({
            id: crypto.randomUUID(),
            command_id: commandRecord.command_id,
            sequence_in_command: sequenceInCommand++,
            event_type: 'order_procurement_progressed',
            event_version: 1,
            aggregate_type: 'order',
            aggregate_id: poItem.pre_order_id,
            correlation_id: commandRecord.command_id,
            causation_id: options.causationId || commandRecord.command_id,
            idempotency_key: `${commandRecord.command_id}:${orderProjection.nextLineState.id}:order_procurement_progressed:${sequenceInCommand - 1}`,
            payload_json: JSON.stringify({
              purchase_order_id: poId,
              order_line_id: orderProjection.nextLineState.id,
              received_qty_delta: receivedQty,
              order_line_received_qty_after: orderProjection.nextLineState.received_qty,
              order_line_display_status_after: orderProjection.nextLineState.display_status,
              order_procurement_status_after: orderProjection.nextProcurementStatus,
            }),
            occurred_at: timestamp,
          });
          orderLineStates.delete(`${compatibilityOrderLine.id}:outbox`);
        }

        results.push({
          id: receiptId,
          purchase_order_item_id: purchaseOrderItemId,
          received_qty: receivedQty,
        });
      }

      const response = {
        purchase_order_id: poId,
        receipt_count: results.length,
        receipts: results,
      };

      statements.push(
        ...this.domainOutboxRepo.buildInsertStatements(
          outboxEvents,
          (event) => getDomainEventDefinition(event.event_type).consumers
        )
      );
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

      await executeBatchChunks(this.db, statements);
      return response;
    } catch (error) {
      if (preflightReverts.length > 0) {
        await executeBatchChunks(this.db, preflightReverts);
      }
      if (ownsReservation) {
        const deleteStatement =
          this.commandIdempotencyRepo.buildDeleteStatement?.(commandRecord.command_id) ||
          buildDeleteCommandStatement(this.db, commandRecord.command_id);
        await deleteStatement.run();
      }
      throw error;
    }
  }
}
