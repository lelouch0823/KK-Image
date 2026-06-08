import { BadRequestError } from '../lib/hono/errors.js';
import { CommandIdempotencyRepository } from '../repositories/CommandIdempotencyRepository.js';
import { DomainOutboxRepository } from '../repositories/DomainOutboxRepository.js';
import { PurchaseReceiptRepository } from '../repositories/PurchaseReceiptRepository.js';
import { executeBatchChunks } from '../lib/db/batch.js';
import { InventoryService } from './InventoryService.js';
import { getDomainEventDefinition } from './DomainEventCatalog.js';
import { projectOrderLineStatus } from './OrderStatusProjectionService.js';
import { VariantDemandProjectionRefreshService } from './VariantDemandProjectionRefreshService.js';
import { queryOrderLineCandidates } from './order-line-shared.js';
import {
  acquireProcurementResourceLocks,
  buildProcurementResourceLockReleaseStatements,
  releaseProcurementResourceLocks,
} from './order-procurement-resource-locks.js';
import {
  buildReceiptRequestFingerprint,
  buildCompatibilityOrderProcurementStatusStatement,
  buildOrderLineProjectionStatement,
  buildPreviousWriteAssertionStatement,
  buildPurchaseOrderItemReceivedQtyStatement,
  buildFinalizeCommandStatements,
  cleanupReservedCommand,
  isPreviousWriteAssertionError,
  queryInventoryBalance,
  queryCompatibilityProcurementAggregate,
  replayReservedCommand,
  resolveReservationOwnership,
  requirePurchaseOrder,
  requirePurchaseOrderItemForPo,
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

function countReceiptWriteStatements(
  preparedReceipts = [],
  { hasCommandInsert = false, lockReleaseCount = 0 } = {}
) {
  return preparedReceipts.reduce(
    (total, prepared) => {
      let nextTotal = total + 3 + RECEIPT_BASE_EVENT_WRITE_COUNT;

      if (prepared.compatibilityOrderLineId && prepared.poItem?.pre_order_id) {
        nextTotal += 2 + RECEIPT_ORDER_EVENT_WRITE_COUNT;
      }

      if (prepared.poItem?.variant_id) {
        nextTotal += 4 + RECEIPT_INVENTORY_EVENT_WRITE_COUNT;
      }

      return nextTotal;
    },
    RECEIPT_FINALIZE_STATEMENT_COUNT +
      (hasCommandInsert ? 1 : 0) +
      Math.max(0, Math.trunc(Number(lockReleaseCount) || 0))
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
    this.variantDemandProjectionRefreshService =
      deps.variantDemandProjectionRefreshService || new VariantDemandProjectionRefreshService(db);
    this.now = deps.now || (() => Date.now());
  }

  async queryCompatibilityOrderLines(
    orderId,
    { productId = null, variantId = null } = {},
    includeScopedFilters = true
  ) {
    if (!orderId) return [];
    return queryOrderLineCandidates(
      this.db,
      { orderId, productId, variantId },
      includeScopedFilters,
      {
        selectColumns:
          'id, order_id, product_id, variant_id, ordered_qty, procured_qty, received_qty, reserved_qty, shipped_qty, cancelled_qty',
      }
    );
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
    await buildOrderLineProjectionStatement(this.db, next, orderLine, timestamp).run();

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
    await buildCompatibilityOrderProcurementStatusStatement(
      this.db,
      orderId,
      nextStatus,
      timestamp,
      {
        excludeTerminalStatuses: true,
        requireStatusChange: true,
      }
    ).run();

    return nextStatus;
  }

  async recordPurchaseOrderReceipts(poId, payload = {}, options = {}) {
    const items = Array.isArray(payload.items) ? payload.items : null;
    if (!items || items.length === 0) throw new BadRequestError('items is required');
    await requirePurchaseOrder(this.db, poId, {
      allowedStatuses: ['ordered', 'shipping'],
      invalidStatusMessage: '仅 ordered 或 shipping 状态的采购单允许收货',
    });

    const idempotencyKey = String(options.idempotencyKey || crypto.randomUUID()).trim();
    const requestFingerprint = buildReceiptRequestFingerprint(poId, payload);
    const commandReservation = await this.commandIdempotencyRepo.reserveReceiptCommand(
      poId,
      idempotencyKey,
      requestFingerprint
    );
    const ownsReservation = resolveReservationOwnership(commandReservation);

    if (commandReservation?.existing) {
      return replayReservedCommand(commandReservation, requestFingerprint, {
        mismatchMessage: '同一个幂等键不能提交不同的收货请求',
        inFlightMessage: '当前幂等键对应的收货命令仍在处理中',
      });
    }

    const timestamp = this.now();
    const commandRecord = commandReservation.record;
    const orderLineStates = new Map();
    const orderAggregateStates = new Map();
    const inventoryStates = new Map();
    const statements = [];
    const results = [];
    const outboxEvents = [];
    const purchaseItemGuardResultIndexes = [];
    const preparedReceipts = [];
    let receiptItemLocks = [];
    let sequenceInCommand = 1;

    if (commandReservation.insertStatement) {
      statements.push(commandReservation.insertStatement);
    }

    for (const entry of items) {
      const normalizedEntry = normalizeReceiptEntry(entry);
      const purchaseOrderItemId = normalizedEntry.purchase_order_item_id;
      const receivedQty = normalizedEntry.received_qty;
      if (!purchaseOrderItemId) throw new BadRequestError('purchase_order_item_id is required');
      if (receivedQty <= 0) throw new BadRequestError('received_qty must be greater than 0');

      const poItem = await requirePurchaseOrderItemForPo(this.db, poId, purchaseOrderItemId);
      const remainingReceivable = computeRemainingReceivable(poItem);
      if (receivedQty > remainingReceivable) {
        throw new BadRequestError(`收货数量超过剩余可收数量: ${remainingReceivable}`);
      }

      const compatibilityOrderLine = poItem.pre_order_id
        ? poItem.order_line_id
          ? await requireOrderLine(this.db, poItem.pre_order_id, poItem.order_line_id)
          : await this.resolveCompatibilityOrderLine(poItem.pre_order_id, {
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

      const purchaseItemStatement = buildPurchaseOrderItemReceivedQtyStatement(
        this.db,
        poId,
        poItem,
        {
          nextReceivedQty: nextReceived,
          nextDisplayStatus: displayStatus,
          requiredRemainingQty: receivedQty,
        }
      );
      purchaseItemGuardResultIndexes.push(statements.length);
      statements.push(purchaseItemStatement);
      statements.push(buildPreviousWriteAssertionStatement(this.db));
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

    if (
      countReceiptWriteStatements(preparedReceipts, {
        hasCommandInsert: Boolean(commandReservation.insertStatement),
        lockReleaseCount: new Set(
          preparedReceipts.map((prepared) => prepared.purchaseOrderItemId).filter(Boolean)
        ).size,
      }) > D1_MAX_BATCH_SIZE
    ) {
      await cleanupReservedCommand({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        db: this.db,
        ownsReservation,
        commandId: commandRecord.command_id,
      });
      throw new BadRequestError('本次收货包含的写入过多，请拆分后重试');
    }

    try {
      receiptItemLocks = await acquireProcurementResourceLocks({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        resourceType: 'purchase_order_item',
        resourceIds: preparedReceipts.map((prepared) => prepared.purchaseOrderItemId),
        timestamp,
        commandId: commandRecord.command_id,
      });
    } catch (error) {
      await cleanupReservedCommand({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        db: this.db,
        ownsReservation,
        commandId: commandRecord.command_id,
      });
      throw error;
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
          statements.push(
            buildOrderLineProjectionStatement(this.db, nextLineState, nextLineState, timestamp)
          );

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
            buildCompatibilityOrderProcurementStatusStatement(
              this.db,
              poItem.pre_order_id,
              nextProcurementStatus,
              timestamp,
              {
                excludeTerminalStatuses: true,
                requireStatusChange: true,
              }
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
            (await queryInventoryBalance(this.db, poItem.variant_id));
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
        ...buildFinalizeCommandStatements({
          db: this.db,
          commandIdempotencyRepo: this.commandIdempotencyRepo,
          purchaseOrderId: poId,
          timestamp,
          commandId: commandRecord.command_id,
          response,
          leadingStatements: this.domainOutboxRepo
            .buildInsertStatements(
              outboxEvents,
              (event) => getDomainEventDefinition(event.event_type).consumers
            )
            .concat(
              buildProcurementResourceLockReleaseStatements({
                commandIdempotencyRepo: this.commandIdempotencyRepo,
                lockRecords: receiptItemLocks,
              })
            ),
        })
      );

      if (statements.length > D1_MAX_BATCH_SIZE) {
        throw new BadRequestError('本次收货包含的写入过多，请拆分后重试');
      }

      const writeResults = await executeBatchChunks(this.db, statements);
      const hasGuardMismatch = purchaseItemGuardResultIndexes.some(
        (resultIndex) => (writeResults?.[resultIndex]?.meta?.changes || 0) !== 1
      );
      if (hasGuardMismatch) {
        throw new BadRequestError('采购单明细收货进度已变化，请刷新后重试');
      }
      await this.variantDemandProjectionRefreshService.refreshByVariantIds(
        preparedReceipts.map((prepared) => prepared.poItem?.variant_id)
      );
      return response;
    } catch (error) {
      await releaseProcurementResourceLocks({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        lockRecords: receiptItemLocks,
      });
      await cleanupReservedCommand({
        commandIdempotencyRepo: this.commandIdempotencyRepo,
        db: this.db,
        ownsReservation,
        commandId: commandRecord.command_id,
      });
      if (isPreviousWriteAssertionError(error)) {
        throw new BadRequestError('采购单明细收货进度已变化，请刷新后重试');
      }
      throw error;
    }
  }
}
