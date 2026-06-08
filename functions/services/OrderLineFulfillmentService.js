import { BadRequestError, ConflictError, NotFoundError } from '../lib/hono/errors.js';
import { DomainOutboxRepository } from '../repositories/DomainOutboxRepository.js';
import { OrderLineAllocationRepository } from '../repositories/OrderLineAllocationRepository.js';
import { toNonNegativeInt } from '../api/utils/number.js';
import { getDomainEventDefinition } from './DomainEventCatalog.js';
import { InventoryService } from './InventoryService.js';
import { VariantDemandProjectionRefreshService } from './VariantDemandProjectionRefreshService.js';
import {
  buildOrderLineProjectionStatement,
  parsePositiveLineCommandQuantity,
  queryInventoryBalance,
} from './order-line-shared.js';
import { projectOrderLineStatus } from './OrderStatusProjectionService.js';

function getRemainingLineQuantity(line) {
  return Math.max(
    toNonNegativeInt(line.ordered_qty) -
      toNonNegativeInt(line.cancelled_qty) -
      toNonNegativeInt(line.shipped_qty),
    0
  );
}

function getReadyLineQuantity(line) {
  return Math.max(
    toNonNegativeInt(line.received_qty) -
      toNonNegativeInt(line.shipped_qty) -
      toNonNegativeInt(line.reserved_qty),
    0
  );
}

function getAllocationRemaining(allocation = {}) {
  return Math.max(
    toNonNegativeInt(allocation.allocated_qty) - toNonNegativeInt(allocation.released_qty),
    0
  );
}

const RETURN_REASON_CODES = Object.freeze([
  'customer_refused',
  'wrong_item',
  'damage',
  'quality_issue',
  'logistics_failure',
  'other',
]);

function parseReturnReason(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!RETURN_REASON_CODES.includes(normalized)) {
    throw new BadRequestError('returns require a valid return reason code');
  }
  return normalized;
}

function normalizeLedgerNote(value) {
  return String(value || '').trim();
}

function buildGuardedLineProjectionStatement(db, line, nextLineState, timestamp) {
  return buildOrderLineProjectionStatement(
    db,
    {
      ...nextLineState,
      id: line.line_id,
      order_id: line.order_id,
    },
    {
      ...line,
      id: line.line_id,
      order_id: line.order_id,
    },
    timestamp,
    { guardProjectionState: true }
  );
}

function buildPreviousWriteAssertionStatement(db) {
  return db.prepare(
    "SELECT json_extract(CASE WHEN changes() = 1 THEN '{}' ELSE 'not-json' END, '$') AS guard_ok"
  );
}

function batchResultChanges(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function isPreviousWriteAssertionError(error) {
  return String(error?.message || error)
    .toLowerCase()
    .includes('malformed json');
}

async function runGuardedBatch(db, statements, conflictMessage) {
  try {
    const results = await db.batch(statements);
    if (batchResultChanges(results?.[0]) !== 1) {
      throw new ConflictError(conflictMessage);
    }
    return results;
  } catch (error) {
    if (isPreviousWriteAssertionError(error)) {
      throw new ConflictError(conflictMessage);
    }
    throw error;
  }
}

export class OrderLineFulfillmentService {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.uuid = deps.uuid || (() => crypto.randomUUID());
    this.allocationRepo = deps.allocationRepo || new OrderLineAllocationRepository(db);
    this.inventoryService = deps.inventoryService || new InventoryService(db);
    this.variantDemandProjectionRefreshService =
      deps.variantDemandProjectionRefreshService || new VariantDemandProjectionRefreshService(db);
    this.domainOutboxRepo =
      deps.domainOutboxRepo ||
      new DomainOutboxRepository(db, {
        now: this.now,
        uuid: this.uuid,
      });
  }

  async refreshDemandProjection(variantId) {
    if (!variantId) return;
    await this.variantDemandProjectionRefreshService.refreshByVariantIds([variantId]);
  }

  async reserveLine(orderId, lineId, payload = {}, options = {}) {
    const line = await this.requireOrderLine(orderId, lineId);
    const quantity = parsePositiveLineCommandQuantity(payload);
    this.assertVariantBacked(line);

    const remaining = getRemainingLineQuantity(line);
    const currentReserved = toNonNegativeInt(line.reserved_qty);
    const reservable = Math.max(remaining - currentReserved, 0);
    if (quantity > reservable) {
      throw new BadRequestError(
        `reserve quantity exceeds remaining reservable quantity: ${reservable}`
      );
    }

    const inventory = await queryInventoryBalance(this.db, line.variant_id);
    const readyQuantity = getReadyLineQuantity(line);
    const reserveCapacity = Math.max(readyQuantity, toNonNegativeInt(inventory.available));
    if (quantity > reserveCapacity) {
      throw new BadRequestError(`reserve quantity exceeds available stock: ${reserveCapacity}`);
    }

    const timestamp = this.now();
    const nextLineState = this.buildNextLineState(line, {
      reserved_qty: currentReserved + quantity,
    });

    const statements = [
      buildGuardedLineProjectionStatement(this.db, line, nextLineState, timestamp),
      buildPreviousWriteAssertionStatement(this.db),
      this.allocationRepo.createInsertStatement({
        id: this.uuid(),
        order_line_id: lineId,
        variant_id: line.variant_id,
        inventory_event_id: null,
        allocated_qty: quantity,
        allocated_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
      }),
      this.buildOrderTouchStatement(orderId, timestamp),
      ...this.buildOutboxStatements({
        order: line,
        orderId,
        lineId,
        action: 'reserve',
        quantity,
        nextLineState,
        timestamp,
        actorName: options.actorName || null,
      }),
    ];

    await runGuardedBatch(this.db, statements, 'order line was modified concurrently');
    return this.buildCommandResult({
      orderId,
      lineId,
      action: 'reserve',
      quantity,
      nextLineState,
      inventory,
    });
  }

  async releaseLine(orderId, lineId, payload = {}, options = {}) {
    const line = await this.requireOrderLine(orderId, lineId);
    const quantity = parsePositiveLineCommandQuantity(payload);
    this.assertVariantBacked(line);

    const currentReserved = toNonNegativeInt(line.reserved_qty);
    if (quantity > currentReserved) {
      throw new BadRequestError(`release quantity exceeds reserved quantity: ${currentReserved}`);
    }

    const activeAllocations = await this.allocationRepo.listActiveByOrderLine(lineId);
    const totalAllocated = activeAllocations.reduce(
      (sum, allocation) => sum + getAllocationRemaining(allocation),
      0
    );
    if (quantity > totalAllocated) {
      throw new BadRequestError(
        `release quantity exceeds active allocation quantity: ${totalAllocated}`
      );
    }

    const timestamp = this.now();
    const nextLineState = this.buildNextLineState(line, {
      reserved_qty: Math.max(currentReserved - quantity, 0),
    });
    const releaseStatements = [];
    let remainingToRelease = quantity;

    for (const allocation of activeAllocations) {
      if (remainingToRelease <= 0) break;
      const releasable = getAllocationRemaining(allocation);
      if (releasable <= 0) continue;

      const releaseQty = Math.min(releasable, remainingToRelease);
      releaseStatements.push(
        this.allocationRepo.buildReleaseStatement(allocation, releaseQty, {
          now: timestamp,
          updated_at: timestamp,
        })
      );
      remainingToRelease -= releaseQty;
    }

    const statements = [
      buildGuardedLineProjectionStatement(this.db, line, nextLineState, timestamp),
      buildPreviousWriteAssertionStatement(this.db),
      ...releaseStatements,
      this.buildOrderTouchStatement(orderId, timestamp),
      ...this.buildOutboxStatements({
        order: line,
        orderId,
        lineId,
        action: 'release',
        quantity,
        nextLineState,
        timestamp,
        actorName: options.actorName || null,
      }),
    ];

    await runGuardedBatch(this.db, statements, 'order line was modified concurrently');
    const inventory = await queryInventoryBalance(this.db, line.variant_id);
    return this.buildCommandResult({
      orderId,
      lineId,
      action: 'release',
      quantity,
      nextLineState,
      inventory,
    });
  }

  async shipLine(orderId, lineId, payload = {}, options = {}) {
    const line = await this.requireOrderLine(orderId, lineId);
    const quantity = parsePositiveLineCommandQuantity(payload);
    this.assertVariantBacked(line);

    const remaining = getRemainingLineQuantity(line);
    if (quantity > remaining) {
      throw new BadRequestError(`ship quantity exceeds remaining quantity: ${remaining}`);
    }

    const inventory = await queryInventoryBalance(this.db, line.variant_id);
    if (quantity > inventory.on_hand) {
      throw new BadRequestError(`ship quantity exceeds on-hand stock: ${inventory.on_hand}`);
    }

    const currentReserved = toNonNegativeInt(line.reserved_qty);
    const reservedConsumed = Math.min(currentReserved, quantity);
    const timestamp = this.now();
    const nextLineState = this.buildNextLineState(line, {
      reserved_qty: Math.max(currentReserved - reservedConsumed, 0),
      shipped_qty: toNonNegativeInt(line.shipped_qty) + quantity,
    });
    const sideEffectStatements = [];

    if (reservedConsumed > 0) {
      const activeAllocations = await this.allocationRepo.listActiveByOrderLine(lineId);
      let remainingToRelease = reservedConsumed;
      for (const allocation of activeAllocations) {
        if (remainingToRelease <= 0) break;
        const releasable = getAllocationRemaining(allocation);
        if (releasable <= 0) continue;

        const releaseQty = Math.min(releasable, remainingToRelease);
        sideEffectStatements.push(
          this.allocationRepo.buildReleaseStatement(allocation, releaseQty, {
            now: timestamp,
            updated_at: timestamp,
          })
        );
        remainingToRelease -= releaseQty;
      }
    }

    const releaseMovement = this.buildReservationMovementStatements({
      variantId: line.variant_id,
      orderId,
      lineId,
      quantityDelta: -quantity,
      eventType: 'inventory_released',
      timestamp,
      metadata: {
        action: 'ship',
        actorName: options.actorName || null,
        reservedConsumed,
      },
    });
    sideEffectStatements.push(...releaseMovement.statements);

    const shipment = await this.inventoryService.buildMutationStatements({
      type: 'order_shipment',
      variantId: line.variant_id,
      quantityDelta: -quantity,
      orderId,
      orderLineId: lineId,
      referenceType: 'order',
      referenceId: orderId,
      metadata: {
        action: 'ship',
        actorName: options.actorName || null,
      },
    });

    sideEffectStatements.push(
      this.buildShipmentLedgerStatement({
        orderId,
        lineId,
        variantId: line.variant_id,
        actionType: 'shipped',
        quantity,
        actorName: options.actorName || null,
        note: normalizeLedgerNote(payload?.note),
        timestamp,
      }),
      ...(shipment?.statements || []),
      this.buildOrderTouchStatement(orderId, timestamp),
      ...this.buildOutboxStatements({
        order: line,
        orderId,
        lineId,
        action: 'ship',
        quantity,
        nextLineState,
        timestamp,
        actorName: options.actorName || null,
      })
    );

    await runGuardedBatch(
      this.db,
      [
        buildGuardedLineProjectionStatement(this.db, line, nextLineState, timestamp),
        buildPreviousWriteAssertionStatement(this.db),
        ...sideEffectStatements,
      ],
      'order line was modified concurrently'
    );
    await this.refreshDemandProjection(line.variant_id);
    return this.buildCommandResult({
      orderId,
      lineId,
      action: 'ship',
      quantity,
      nextLineState,
      inventory,
    });
  }

  async unshipLine(orderId, lineId, payload = {}, options = {}) {
    const line = await this.requireOrderLine(orderId, lineId);
    const quantity = parsePositiveLineCommandQuantity(payload);
    this.assertVariantBacked(line);
    this.assertUnshipAllowed(line);

    const currentShipped = toNonNegativeInt(line.shipped_qty);
    if (quantity > currentShipped) {
      throw new BadRequestError(`unship quantity exceeds shipped quantity: ${currentShipped}`);
    }

    const inventory = await queryInventoryBalance(this.db, line.variant_id);
    const timestamp = this.now();
    const nextLineState = this.buildNextLineState(line, {
      shipped_qty: Math.max(currentShipped - quantity, 0),
    });

    const unshipment = await this.inventoryService.buildMutationStatements({
      type: 'order_unshipment',
      variantId: line.variant_id,
      quantityDelta: quantity,
      orderId,
      orderLineId: lineId,
      referenceType: 'order',
      referenceId: orderId,
      metadata: {
        action: 'unship',
        actorName: options.actorName || null,
      },
    });

    const statements = [
      buildGuardedLineProjectionStatement(this.db, line, nextLineState, timestamp),
      buildPreviousWriteAssertionStatement(this.db),
      this.buildShipmentLedgerStatement({
        orderId,
        lineId,
        variantId: line.variant_id,
        actionType: 'unshipped',
        quantity,
        actorName: options.actorName || null,
        note: normalizeLedgerNote(payload?.note),
        timestamp,
      }),
      ...(unshipment?.statements || []),
      this.buildOrderTouchStatement(orderId, timestamp),
      ...this.buildOutboxStatements({
        order: line,
        orderId,
        lineId,
        action: 'unship',
        quantity,
        nextLineState,
        timestamp,
        actorName: options.actorName || null,
      }),
    ];

    await runGuardedBatch(this.db, statements, 'order line was modified concurrently');
    await this.refreshDemandProjection(line.variant_id);
    return this.buildCommandResult({
      orderId,
      lineId,
      action: 'unship',
      quantity,
      nextLineState,
      inventory,
    });
  }

  async returnLine(orderId, lineId, payload = {}, options = {}) {
    const line = await this.requireOrderLine(orderId, lineId);
    const quantity = parsePositiveLineCommandQuantity(payload);
    const reason = parseReturnReason(payload?.reason);
    this.assertVariantBacked(line);
    this.assertReturnAllowed(line);

    const returnedQty = await this.getReturnedQuantity(lineId);
    const currentShipped = toNonNegativeInt(line.shipped_qty);
    const returnableQty = Math.max(currentShipped - returnedQty, 0);
    if (quantity > returnableQty) {
      throw new BadRequestError(
        `return quantity exceeds shipped returnable quantity: ${returnableQty}`
      );
    }

    const inventory = await queryInventoryBalance(this.db, line.variant_id);
    const timestamp = this.now();
    const nextReturnedQty = returnedQty + quantity;
    const nextLineState = this.buildNextLineState(line);
    const returnId = this.uuid();
    const nextOrderDeliveryStatus = await this.deriveNextOrderDeliveryStatus(orderId, quantity);

    const restock = await this.inventoryService.buildMutationStatements({
      type: 'order_return_restock',
      variantId: line.variant_id,
      quantityDelta: quantity,
      orderId,
      orderLineId: lineId,
      referenceType: 'order',
      referenceId: orderId,
      metadata: {
        action: 'return',
        actorId: options.actorId || null,
        actorName: options.actorName || null,
        orderReturnId: returnId,
      },
    });

    const statements = [
      this.db
        .prepare(
          'UPDATE orders SET delivery_status = ?, updated_at = ? WHERE id = ? AND delivery_status = ?'
        )
        .bind(nextOrderDeliveryStatus, timestamp, orderId, line.delivery_status),
      buildPreviousWriteAssertionStatement(this.db),
      ...(restock?.statements || []),
      this.db
        .prepare(
          `INSERT INTO order_returns (
             id, order_id, order_line_id, variant_id, quantity, status, reason, note, created_by, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'restocked', ?, ?, ?, ?, ?)`
        )
        .bind(
          returnId,
          orderId,
          lineId,
          line.variant_id,
          quantity,
          reason,
          payload?.note || '',
          options.actorName || null,
          timestamp,
          timestamp
        ),
      this.buildOrderTouchStatement(orderId, timestamp),
      ...this.buildOutboxStatements({
        order: line,
        orderId,
        lineId,
        action: 'return',
        quantity,
        nextLineState,
        returnedQtyAfter: nextReturnedQty,
        timestamp,
        actorName: options.actorName || null,
      }),
    ];

    await runGuardedBatch(this.db, statements, 'order was modified concurrently');
    return this.buildCommandResult({
      orderId,
      lineId,
      action: 'return',
      quantity,
      nextLineState,
      returnedQtyAfter: nextReturnedQty,
      inventory,
    });
  }

  async requireOrderLine(orderId, lineId) {
    const row = await this.db
      .prepare(
        `SELECT
            o.id AS order_id,
            o.order_no,
            o.salesperson_id,
            o.status AS order_status,
            o.delivery_status,
            ol.id AS line_id,
            ol.product_id,
            ol.variant_id,
            ol.ordered_qty,
            ol.procured_qty,
            ol.received_qty,
            ol.reserved_qty,
            ol.shipped_qty,
            ol.cancelled_qty,
            ol.display_status
         FROM orders o
         JOIN order_lines ol ON ol.order_id = o.id
         WHERE o.id = ?
           AND o.archived_at IS NULL
           AND ol.id = ?
         LIMIT 1`
      )
      .bind(orderId, lineId)
      .first();

    if (!row) {
      throw new NotFoundError('order line not found');
    }

    return row;
  }

  assertVariantBacked(line) {
    if (!line?.variant_id) {
      throw new BadRequestError('order line is not bound to a variant');
    }
  }

  assertUnshipAllowed(line) {
    const orderStatus = String(line?.order_status || '')
      .trim()
      .toLowerCase();
    const deliveryStatus = String(line?.delivery_status || '')
      .trim()
      .toLowerCase();
    if (
      orderStatus === 'delivered' ||
      ['delivered', 'partially_returned', 'returned'].includes(deliveryStatus)
    ) {
      throw new BadRequestError('cannot unship line from a delivered order');
    }
  }

  assertReturnAllowed(line) {
    const orderStatus = String(line?.order_status || '')
      .trim()
      .toLowerCase();
    const deliveryStatus = String(line?.delivery_status || '')
      .trim()
      .toLowerCase();
    // fulfilled 状态等同于已交付，允许退货
    if (orderStatus === 'fulfilled') {
      return;
    }
    if (!['delivered', 'partially_returned', 'returned'].includes(deliveryStatus)) {
      throw new BadRequestError('returns require a delivery-confirmed order');
    }
  }

  async getReturnedQuantity(lineId) {
    const row = await this.db
      .prepare(
        `SELECT COALESCE(SUM(quantity), 0) AS returned_qty
         FROM order_returns
         WHERE order_line_id = ?
           AND status != 'cancelled'`
      )
      .bind(lineId)
      .first();

    return toNonNegativeInt(row?.returned_qty);
  }

  async deriveNextOrderDeliveryStatus(orderId, addedReturnedQty) {
    const row = await this.db
      .prepare(
        `SELECT
            COALESCE(SUM(ol.shipped_qty), 0) AS shipped_qty,
            COALESCE(SUM(orq.returned_qty), 0) AS returned_qty
         FROM order_lines ol
         LEFT JOIN (
             SELECT
                 order_line_id,
                 COALESCE(SUM(quantity), 0) AS returned_qty
             FROM order_returns
             WHERE status != 'cancelled'
             GROUP BY order_line_id
         ) orq ON orq.order_line_id = ol.id
         WHERE ol.order_id = ?`
      )
      .bind(orderId)
      .first();

    const shippedQty = toNonNegativeInt(row?.shipped_qty);
    const returnedQty = toNonNegativeInt(row?.returned_qty) + toNonNegativeInt(addedReturnedQty);
    if (shippedQty > 0 && returnedQty >= shippedQty) return 'returned';
    if (returnedQty > 0) return 'partially_returned';
    return 'delivered';
  }

  buildNextLineState(line, overrides = {}) {
    const next = {
      ordered_qty: toNonNegativeInt(line.ordered_qty),
      procured_qty: toNonNegativeInt(line.procured_qty),
      received_qty: toNonNegativeInt(line.received_qty),
      reserved_qty: toNonNegativeInt(line.reserved_qty),
      shipped_qty: toNonNegativeInt(line.shipped_qty),
      cancelled_qty: toNonNegativeInt(line.cancelled_qty),
      ...overrides,
    };

    next.display_status = projectOrderLineStatus(next);
    return next;
  }

  buildOrderTouchStatement(orderId, timestamp) {
    return this.db
      .prepare('UPDATE orders SET updated_at = ? WHERE id = ?')
      .bind(timestamp, orderId);
  }

  buildShipmentLedgerStatement({
    orderId,
    lineId,
    variantId,
    actionType,
    quantity,
    actorName,
    note = '',
    timestamp,
  }) {
    return this.db
      .prepare(
        `INSERT INTO order_shipments (
           id, order_id, order_line_id, variant_id, action_type, quantity, note, created_by, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        this.uuid(),
        orderId,
        lineId,
        variantId || null,
        actionType,
        quantity,
        note,
        actorName || null,
        timestamp
      );
  }

  buildReservationMovementStatements({
    variantId,
    orderId,
    lineId,
    quantityDelta,
    eventType,
    timestamp,
    metadata = {},
  }) {
    const ledgerId = this.uuid();
    const inventoryEventId = this.uuid();

    return {
      inventoryEventId,
      statements: [
        this.db
          .prepare(
            `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
             VALUES (?, 0, ?, 0, ?)
             ON CONFLICT(variant_id) DO UPDATE SET
               reserved = MAX(0, inventory_balances.reserved + ?),
               available = MAX(0, inventory_balances.on_hand - MAX(0, inventory_balances.reserved + ?)),
               updated_at = excluded.updated_at`
          )
          .bind(variantId, Math.max(quantityDelta, 0), timestamp, quantityDelta, quantityDelta),
        this.db
          .prepare(
            `INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            ledgerId,
            variantId,
            eventType,
            quantityDelta,
            'order_line',
            lineId,
            timestamp,
            JSON.stringify({
              orderId,
              lineId,
              ...metadata,
            }),
            timestamp
          ),
        this.db
          .prepare(
            `INSERT INTO inventory_events (
              id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta,
              source_type, source_id, metadata, occurred_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            inventoryEventId,
            variantId,
            lineId,
            null,
            eventType,
            quantityDelta,
            'order_line',
            lineId,
            JSON.stringify({
              orderId,
              lineId,
              ...metadata,
            }),
            timestamp,
            timestamp
          ),
      ],
    };
  }

  buildOutboxStatements({
    order,
    orderId,
    lineId,
    action,
    quantity,
    nextLineState,
    returnedQtyAfter = null,
    timestamp,
    actorName = null,
  }) {
    const commandId = this.uuid();
    const outboxEvents = [];

    outboxEvents.push({
      id: this.uuid(),
      command_id: commandId,
      sequence_in_command: 1,
      event_type: 'order_line_fulfillment_updated',
      event_version: 1,
      aggregate_type: 'order',
      aggregate_id: orderId,
      correlation_id: commandId,
      causation_id: commandId,
      idempotency_key: `${commandId}:${lineId}:${action}`,
      payload_json: JSON.stringify({
        order_id: orderId,
        order_no: order.order_no || null,
        salesperson_id: order.salesperson_id || null,
        order_line_id: lineId,
        variant_id: order.variant_id || null,
        action,
        quantity,
        actor_name: actorName,
        reserved_qty_after: nextLineState.reserved_qty,
        shipped_qty_after: nextLineState.shipped_qty,
        returned_qty_after: returnedQtyAfter,
        display_status_after: nextLineState.display_status,
      }),
      occurred_at: timestamp,
    });

    return this.domainOutboxRepo.buildInsertStatements(
      outboxEvents,
      (event) => getDomainEventDefinition(event.event_type).consumers
    );
  }

  buildCommandResult({
    orderId,
    lineId,
    action,
    quantity,
    nextLineState,
    returnedQtyAfter = null,
    inventory,
  }) {
    return {
      order_id: orderId,
      order_line_id: lineId,
      action,
      quantity,
      order_line: {
        reserved_qty: nextLineState.reserved_qty,
        shipped_qty: nextLineState.shipped_qty,
        returned_qty: returnedQtyAfter,
        display_status: nextLineState.display_status,
      },
      inventory,
    };
  }
}
