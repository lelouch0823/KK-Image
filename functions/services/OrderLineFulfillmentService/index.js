import { BadRequestError } from '../../lib/hono/errors.js';
import { DomainOutboxRepository } from '../../repositories/DomainOutboxRepository.js';
import { OrderLineAllocationRepository } from '../../repositories/OrderLineAllocationRepository.js';
import { toNonNegativeInt } from '../../api/utils/number.js';
import { InventoryService } from '../InventoryService.js';
import { VariantDemandProjectionRefreshService } from '../VariantDemandProjectionRefreshService.js';
import {
  parsePositiveLineCommandQuantity,
  queryInventoryBalance,
} from '../order-line-shared.js';

import {
  getRemainingLineQuantity,
  getReadyLineQuantity,
  getAllocationRemaining,
  parseReturnReason,
  normalizeLedgerNote,
  buildGuardedLineProjectionStatement,
  buildPreviousWriteAssertionStatement,
  runGuardedBatch,
} from './helpers.js';

import {
  queryOrderLine,
  assertVariantBacked,
  assertUnshipAllowed,
  assertReturnAllowed,
  queryReturnedQuantity,
  queryDerivedDeliveryStatus,
} from './validators.js';

import {
  buildNextLineState,
  buildOrderTouchStatement,
  buildShipmentLedgerStatement,
  buildReservationMovementStatements,
  buildOutboxStatements,
  buildCommandResult,
} from './statement-builders.js';

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

  async requireOrderLine(orderId, lineId) {
    return queryOrderLine(this.db, orderId, lineId);
  }

  async reserveLine(orderId, lineId, payload = {}, options = {}) {
    const line = await this.requireOrderLine(orderId, lineId);
    const quantity = parsePositiveLineCommandQuantity(payload);
    assertVariantBacked(line);

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
    const nextLineState = buildNextLineState(line, {
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
      buildOrderTouchStatement(this.db, orderId, timestamp),
      ...buildOutboxStatements(this.domainOutboxRepo, this.uuid, {
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
    return buildCommandResult({
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
    assertVariantBacked(line);

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
    const nextLineState = buildNextLineState(line, {
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
      buildOrderTouchStatement(this.db, orderId, timestamp),
      ...buildOutboxStatements(this.domainOutboxRepo, this.uuid, {
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
    return buildCommandResult({
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
    assertVariantBacked(line);

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
    const unreservedQuantity = Math.max(quantity - reservedConsumed, 0);
    if (unreservedQuantity > toNonNegativeInt(inventory.available)) {
      throw new BadRequestError(
        `ship quantity exceeds available stock: ${toNonNegativeInt(inventory.available) + reservedConsumed}`
      );
    }

    const timestamp = this.now();
    const nextLineState = buildNextLineState(line, {
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

    if (reservedConsumed > 0) {
      const releaseMovement = buildReservationMovementStatements(this.db, this.uuid, {
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
      sideEffectStatements.push(...releaseMovement.statements);
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

    sideEffectStatements.push(
      buildShipmentLedgerStatement(this.db, this.uuid, {
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
      buildOrderTouchStatement(this.db, orderId, timestamp),
      ...buildOutboxStatements(this.domainOutboxRepo, this.uuid, {
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
    return buildCommandResult({
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
    assertVariantBacked(line);
    assertUnshipAllowed(line);

    const currentShipped = toNonNegativeInt(line.shipped_qty);
    if (quantity > currentShipped) {
      throw new BadRequestError(`unship quantity exceeds shipped quantity: ${currentShipped}`);
    }

    const inventory = await queryInventoryBalance(this.db, line.variant_id);
    const timestamp = this.now();
    const nextLineState = buildNextLineState(line, {
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
      buildShipmentLedgerStatement(this.db, this.uuid, {
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
      buildOrderTouchStatement(this.db, orderId, timestamp),
      ...buildOutboxStatements(this.domainOutboxRepo, this.uuid, {
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
    return buildCommandResult({
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
    assertVariantBacked(line);
    assertReturnAllowed(line);

    const returnedQty = await queryReturnedQuantity(this.db, lineId);
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
    const nextLineState = buildNextLineState(line);
    const returnId = this.uuid();
    const nextOrderDeliveryStatus = await queryDerivedDeliveryStatus(this.db, orderId, quantity);

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
      buildOrderTouchStatement(this.db, orderId, timestamp),
      ...buildOutboxStatements(this.domainOutboxRepo, this.uuid, {
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
    return buildCommandResult({
      orderId,
      lineId,
      action: 'return',
      quantity,
      nextLineState,
      returnedQtyAfter: nextReturnedQty,
      inventory,
    });
  }
}
