import { BadRequestError, NotFoundError } from '../lib/hono/errors.js';
import { DomainOutboxRepository } from '../repositories/DomainOutboxRepository.js';
import { OrderLineAllocationRepository } from '../repositories/OrderLineAllocationRepository.js';
import { getDomainEventDefinition } from './DomainEventCatalog.js';
import { InventoryService } from './InventoryService.js';
import { projectOrderLineStatus } from './OrderStatusProjectionService.js';

function toNonNegativeInt(value) {
  return Math.max(0, Number(value) || 0);
}

function normalizeQuantity(payload = {}) {
  const quantity = Number(payload.quantity ?? payload.qty ?? payload.amount);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BadRequestError('quantity must be a positive number');
  }
  return Math.floor(quantity);
}

function getRemainingLineQuantity(line) {
  return Math.max(
    toNonNegativeInt(line.ordered_qty) - toNonNegativeInt(line.cancelled_qty) - toNonNegativeInt(line.shipped_qty),
    0
  );
}

function getAllocationRemaining(allocation = {}) {
  return Math.max(toNonNegativeInt(allocation.allocated_qty) - toNonNegativeInt(allocation.released_qty), 0);
}

export class OrderLineFulfillmentService {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.uuid = deps.uuid || (() => crypto.randomUUID());
    this.allocationRepo = deps.allocationRepo || new OrderLineAllocationRepository(db);
    this.inventoryService = deps.inventoryService || new InventoryService(db);
    this.domainOutboxRepo = deps.domainOutboxRepo || new DomainOutboxRepository(db, {
      now: this.now,
      uuid: this.uuid,
    });
  }

  async reserveLine(orderId, lineId, payload = {}, options = {}) {
    const line = await this.requireOrderLine(orderId, lineId);
    const quantity = normalizeQuantity(payload);
    this.assertVariantBacked(line);

    const remaining = getRemainingLineQuantity(line);
    const currentReserved = toNonNegativeInt(line.reserved_qty);
    const reservable = Math.max(remaining - currentReserved, 0);
    if (quantity > reservable) {
      throw new BadRequestError(`reserve quantity exceeds remaining reservable quantity: ${reservable}`);
    }

    const inventory = await this.queryInventoryBalance(line.variant_id);
    if (quantity > inventory.available) {
      throw new BadRequestError(`reserve quantity exceeds available stock: ${inventory.available}`);
    }

    const timestamp = this.now();
    const nextLineState = this.buildNextLineState(line, {
      reserved_qty: currentReserved + quantity,
    });
    const reserveMovement = this.buildReservationMovementStatements({
      variantId: line.variant_id,
      orderId,
      lineId,
      quantityDelta: quantity,
      eventType: 'inventory_reserved',
      timestamp,
      metadata: {
        action: 'reserve',
        actorName: options.actorName || null,
      },
    });

    const statements = [
      ...reserveMovement.statements,
      this.buildOrderLineUpdateStatement(line, nextLineState, timestamp),
      this.allocationRepo.createInsertStatement({
        id: this.uuid(),
        order_line_id: lineId,
        variant_id: line.variant_id,
        inventory_event_id: reserveMovement.inventoryEventId,
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

    await this.db.batch(statements);
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
    const quantity = normalizeQuantity(payload);
    this.assertVariantBacked(line);

    const currentReserved = toNonNegativeInt(line.reserved_qty);
    if (quantity > currentReserved) {
      throw new BadRequestError(`release quantity exceeds reserved quantity: ${currentReserved}`);
    }

    const activeAllocations = await this.allocationRepo.listActiveByOrderLine(lineId);
    const totalAllocated = activeAllocations.reduce((sum, allocation) => sum + getAllocationRemaining(allocation), 0);
    if (quantity > totalAllocated) {
      throw new BadRequestError(`release quantity exceeds active allocation quantity: ${totalAllocated}`);
    }

    const timestamp = this.now();
    const nextLineState = this.buildNextLineState(line, {
      reserved_qty: Math.max(currentReserved - quantity, 0),
    });
    const releaseMovement = this.buildReservationMovementStatements({
      variantId: line.variant_id,
      orderId,
      lineId,
      quantityDelta: -quantity,
      eventType: 'inventory_released',
      timestamp,
      metadata: {
        action: 'release',
        actorName: options.actorName || null,
      },
    });
    const statements = [...releaseMovement.statements];
    let remainingToRelease = quantity;

    for (const allocation of activeAllocations) {
      if (remainingToRelease <= 0) break;
      const releasable = getAllocationRemaining(allocation);
      if (releasable <= 0) continue;

      const releaseQty = Math.min(releasable, remainingToRelease);
      statements.push(
        this.allocationRepo.buildReleaseStatement(allocation, releaseQty, {
          now: timestamp,
          updated_at: timestamp,
        })
      );
      remainingToRelease -= releaseQty;
    }

    statements.push(
      this.buildOrderLineUpdateStatement(line, nextLineState, timestamp),
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
      })
    );

    await this.db.batch(statements);
    const inventory = await this.queryInventoryBalance(line.variant_id);
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
    const quantity = normalizeQuantity(payload);
    this.assertVariantBacked(line);

    const remaining = getRemainingLineQuantity(line);
    if (quantity > remaining) {
      throw new BadRequestError(`ship quantity exceeds remaining quantity: ${remaining}`);
    }

    const inventory = await this.queryInventoryBalance(line.variant_id);
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
    const statements = [];

    if (reservedConsumed > 0) {
      const activeAllocations = await this.allocationRepo.listActiveByOrderLine(lineId);
      let remainingToRelease = reservedConsumed;
      for (const allocation of activeAllocations) {
        if (remainingToRelease <= 0) break;
        const releasable = getAllocationRemaining(allocation);
        if (releasable <= 0) continue;

        const releaseQty = Math.min(releasable, remainingToRelease);
        statements.push(
          this.allocationRepo.buildReleaseStatement(allocation, releaseQty, {
            now: timestamp,
            updated_at: timestamp,
          })
        );
        remainingToRelease -= releaseQty;
      }

      const releaseMovement = this.buildReservationMovementStatements({
        variantId: line.variant_id,
        orderId,
        lineId,
        quantityDelta: -reservedConsumed,
        eventType: 'inventory_released',
        timestamp,
        metadata: {
          action: 'ship',
          actorName: options.actorName || null,
          reservedConsumed,
        },
      });
      statements.push(...releaseMovement.statements);
    }

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

    statements.push(
      ...(shipment?.statements || []),
      this.buildOrderLineUpdateStatement(line, nextLineState, timestamp),
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

    await this.db.batch(statements);
    return this.buildCommandResult({
      orderId,
      lineId,
      action: 'ship',
      quantity,
      nextLineState,
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

  async queryInventoryBalance(variantId) {
    const row = await this.db
      .prepare(
        `SELECT variant_id, on_hand, reserved, available
         FROM inventory_balances
         WHERE variant_id = ?`
      )
      .bind(variantId)
      .first();

    return {
      variant_id: variantId,
      on_hand: toNonNegativeInt(row?.on_hand),
      reserved: toNonNegativeInt(row?.reserved),
      available: toNonNegativeInt(row?.available),
    };
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

  buildOrderLineUpdateStatement(line, nextLineState, timestamp) {
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
        nextLineState.ordered_qty,
        nextLineState.procured_qty,
        nextLineState.received_qty,
        nextLineState.reserved_qty,
        nextLineState.shipped_qty,
        nextLineState.cancelled_qty,
        nextLineState.display_status,
        timestamp,
        line.line_id,
        line.order_id
      );
  }

  buildOrderTouchStatement(orderId, timestamp) {
    return this.db
      .prepare('UPDATE orders SET updated_at = ? WHERE id = ?')
      .bind(timestamp, orderId);
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
          .bind(
            variantId,
            Math.max(quantityDelta, 0),
            timestamp,
            quantityDelta,
            quantityDelta
          ),
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
        display_status_after: nextLineState.display_status,
      }),
      occurred_at: timestamp,
    });

    return this.domainOutboxRepo.buildInsertStatements(
      outboxEvents,
      (event) => getDomainEventDefinition(event.event_type).consumers
    );
  }

  buildCommandResult({ orderId, lineId, action, quantity, nextLineState, inventory }) {
    return {
      order_id: orderId,
      order_line_id: lineId,
      action,
      quantity,
      order_line: {
        reserved_qty: nextLineState.reserved_qty,
        shipped_qty: nextLineState.shipped_qty,
        display_status: nextLineState.display_status,
      },
      inventory,
    };
  }
}
