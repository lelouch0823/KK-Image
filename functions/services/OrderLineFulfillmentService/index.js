import { BadRequestError } from '../../lib/hono/errors.js';
import { DomainOutboxRepository } from '../../repositories/DomainOutboxRepository.js';
import { OrderLineAllocationRepository } from '../../repositories/OrderLineAllocationRepository.js';
import { toNonNegativeInt } from '../../api/utils/number.js';
import { InventoryService } from '../InventoryService.js';
import { ProductProjectionRefreshService } from '../ProductProjectionRefreshService.js';
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
  queryOrderReturn,
} from './validators.js';

import {
  buildNextLineState,
  buildOrderTouchStatement,
  buildShipmentLedgerStatement,
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
    this.productProjectionRefreshService =
      deps.productProjectionRefreshService || new ProductProjectionRefreshService(db);
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

  /**
   * 行级命令直接改动库存（ship/unship/return），与 InventoryService.applyMutation
   * 一样必须刷新商品投影，否则商品侧库存展示字段滞后（审查 B-L2）
   */
  async refreshInventoryProjections(variantId) {
    if (!variantId) return;
    await this.refreshDemandProjection(variantId);
    await this.productProjectionRefreshService.refreshByVariantIds([variantId]);
  }

  /**
   * 订单进入终态（void/rejected）时释放全部行级预留。
   *
   * 订单状态机迁移只释放 DemandService 的订单级预留（inventory_balances.reserved
   * 中按订单数量记账的部分）；行级 reserve 命令产生的 order_lines.reserved_qty、
   * order_line_allocations 必须在此逐行释放，否则进入终态后
   * releaseLine 因行/订单守卫而永久不可达，预留成为死库存（审查 B-H1）。
   *
   * 以活跃 allocation 为准（而非 reserved_qty > 0）：终态兼容语句可能在同
   * batch 内已把单行订单的 reserved_qty 清零（审查 B7），若按 reserved_qty
   * 查询会漏掉这些行，allocation 永久滞留 active（审查 B-H1 的残留路径）。
   * 单行失败不阻塞其余行的清算（best-effort），失败原因记录日志供对账。
   */
  async releaseAllLineReservations(orderId, options = {}) {
    const allocations = await this.allocationRepo.listActiveByOrder(orderId);
    if (!allocations || allocations.length === 0) return [];

    const lineIds = [...new Set(allocations.map((allocation) => allocation.order_line_id))];
    const results = [];
    for (const lineId of lineIds) {
      try {
        const result = await this.releaseLineAllocationsForTerminal(orderId, lineId, options);
        results.push({ order_line_id: lineId, released: true, result });
      } catch (error) {
        console.error(
          `releaseAllLineReservations: failed to release line ${lineId} of order ${orderId}:`,
          error
        );
        results.push({ order_line_id: lineId, released: false, error: String(error?.message || error) });
      }
    }
    return results;
  }

  /**
   * 终态清算单行：释放该行全部活跃 allocation，并把 reserved_qty 归零。
   *
   * 与 releaseLine 的区别：不要求 quantity ≤ 当前 reserved_qty——兼容语句
   * 可能已把 reserved_qty 清零而 allocation 仍活跃；reserved_qty 仅按
   * min(当前值, 清算量) 递减，避免把已被并发命令改小的值打成负数。
   * @private
   */
  async releaseLineAllocationsForTerminal(orderId, lineId, options = {}) {
    const line = await this.requireOrderLine(orderId, lineId);
    const activeAllocations = await this.allocationRepo.listActiveByOrderLine(lineId);
    const totalRemaining = activeAllocations.reduce(
      (sum, allocation) => sum + getAllocationRemaining(allocation),
      0
    );
    if (totalRemaining <= 0) {
      return { quantity: 0, allocationsReleased: 0 };
    }

    const timestamp = this.now();
    const currentReserved = toNonNegativeInt(line.reserved_qty);
    const quantityToRelease = Math.min(currentReserved, totalRemaining);
    const nextLineState = buildNextLineState(line, {
      reserved_qty: Math.max(currentReserved - quantityToRelease, 0),
    });

    const statements = [
      buildGuardedLineProjectionStatement(this.db, line, nextLineState, timestamp),
      buildPreviousWriteAssertionStatement(this.db),
      ...activeAllocations.map((allocation) =>
        this.allocationRepo.buildReleaseStatement(allocation, getAllocationRemaining(allocation), {
          now: timestamp,
          updated_at: timestamp,
        })
      ),
      buildOrderTouchStatement(this.db, orderId, timestamp),
      ...buildOutboxStatements(this.domainOutboxRepo, this.uuid, {
        order: line,
        orderId,
        lineId,
        action: 'release',
        quantity: totalRemaining,
        nextLineState,
        timestamp,
        actorName: options.actorName || null,
      }),
    ];

    await runGuardedBatch(this.db, statements, 'order line was modified concurrently');
    return { quantity: totalRemaining, allocationsReleased: activeAllocations.length };
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
      // R6（F6）：容量仲裁下沉到 batch 内——INSERT..SELECT 的 WHERE 谓词在
      // 语句执行时点汇总全部并发预留的承诺量（其他行的活跃 allocation +
      // 本行已有的活跃 allocation + 本次请求），并以执行时点的池值
      // MAX(本行 ready, available) 为上限。B1 单一写入者模型下行级命令不
      // 触碰 inventory_balances（只读池值），两个并发 reserve(5) 在
      // available=5 上只有第一个能命中插入，第二个 0 行 → runGuardedBatch
      // 断言失败回滚（消除 batch 外预检的 TOCTOU 超订窗口）。
      // 注意"本行已有承诺"计入上限两侧（等式两边同加）——本行的既有预留
      // 不应挤占本行自己的追加预留容量。
      this.db
        .prepare(
          `INSERT INTO order_line_allocations (
            id, order_line_id, variant_id, inventory_event_id,
            allocated_qty, released_qty, status,
            allocated_at, released_at, created_at, updated_at
          )
          SELECT ?, ?, ?, NULL, ?, 0, 'active', ?, NULL, ?, ?
          WHERE (
            SELECT COALESCE(SUM(a.allocated_qty - a.released_qty), 0)
            FROM order_line_allocations a
            WHERE a.variant_id = ? AND a.status = 'active' AND a.order_line_id != ?
          ) + ? <= (
            SELECT MAX(?, COALESCE(MAX(0, ib.on_hand - ib.reserved), 0))
            FROM inventory_balances ib WHERE ib.variant_id = ?
          ) + (
            SELECT COALESCE(SUM(a2.allocated_qty - a2.released_qty), 0)
            FROM order_line_allocations a2
            WHERE a2.variant_id = ? AND a2.status = 'active' AND a2.order_line_id = ?
          )`
        )
        .bind(
          this.uuid(),
          lineId,
          line.variant_id,
          quantity,
          timestamp,
          timestamp,
          timestamp,
          // 谓词（全部在语句执行时点求值）：其他行承诺 + 本次请求
          // ≤ MAX(本行 ready, 池 available) + 本行已有承诺
          line.variant_id,
          lineId,
          quantity,
          readyQuantity,
          line.variant_id,
          line.variant_id,
          lineId
        ),
      // R6：INSERT..SELECT 0 行（容量仲裁拒绝）必须回滚——紧随 changes()=1
      // 断言，与第 1 条 guarded projection 的断言模式一致
      buildPreviousWriteAssertionStatement(this.db),
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

    await runGuardedBatch(
      this.db,
      statements,
      '订单行已被并发修改，或可用库存不足以完成预留（可能已被其他订单行预留）'
    );
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
      let releasedTotal = 0;
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
        releasedTotal += releaseQty;
      }
      // R11（F15）：reserved_qty 与活跃 allocation 漂移告警——allocation 按
      // 剩余量封顶释放，若两者已背离（历史数据），残余量无人认领且无痕迹；
      // 记录对账线索供人工核对（不改写数据，漂移只能经对账修复）
      if (remainingToRelease > 0) {
        console.warn(
          `[OrderLineFulfillment] reservation drift on ship: line=${lineId} ` +
            `reservedConsumed=${reservedConsumed} allocationsReleased=${releasedTotal} ` +
            `unreleased=${remainingToRelease}; reserved_qty vs active allocations drifted — needs reconciliation`
        );
      }
    }

    // 行级命令不触碰 inventory_balances.reserved（单一写入者模型，审查 B1）：
    // 该池的唯一写入者是 DemandService 的订单级 hold/release 对。若 shipLine
    // 在此释放 reservedConsumed，pending 订单（从未持有订单级 hold）会把池
    // 打成负数触发 0099 CHECK；confirmed 订单则会在终态被 DemandService
    // 再次全量释放，双重释放同样越限——两条路径都会让预留记账永久损坏。
    // 行级预留的容量约束由 reserve 时的 available 预检 + ship 时的
    // on_hand 守卫增量（inventoryService.buildMutationStatements）共同保证。

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
    await this.refreshInventoryProjections(line.variant_id);
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
    await this.refreshInventoryProjections(line.variant_id);
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
          'UPDATE orders SET delivery_status = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL AND delivery_status = ?'
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
    await this.refreshInventoryProjections(line.variant_id);
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

  /**
   * 冲正退货（审查 B-M2）：将已入账的 restocked 退货整单作废——
   * 反向库存事件扣回实物、order_returns 状态置为 cancelled。
   * returned_qty 聚合排除 cancelled 行，冲正后该数量恢复为可退。
   * 仅 restocked 状态可冲正，且不允许部分数量（冲正是退货记录级操作）。
   */
  async cancelReturn(orderId, lineId, returnId, options = {}) {
    const line = await this.requireOrderLine(orderId, lineId);
    assertVariantBacked(line);

    const returnRecord = await queryOrderReturn(this.db, orderId, lineId, returnId);
    if (!returnRecord) {
      throw new BadRequestError(`退货记录不存在: ${returnId}`);
    }
    if (returnRecord.status !== 'restocked') {
      throw new BadRequestError(`仅 restocked 状态的退货可冲正，当前状态: ${returnRecord.status}`);
    }
    const quantity = toNonNegativeInt(returnRecord.quantity);
    if (quantity <= 0) {
      throw new BadRequestError('退货记录数量无效，无法冲正');
    }

    const inventory = await queryInventoryBalance(this.db, line.variant_id);
    if (quantity > toNonNegativeInt(inventory.on_hand)) {
      throw new BadRequestError(
        `当前库存不足以冲正退货（需扣回 ${quantity} 件，现有 ${inventory.on_hand} 件）`
      );
    }

    const timestamp = this.now();
    // R10（F10）：queryReturnedQuantity 在退货被置 cancelled 之前执行，计数
    // 仍包含本次冲正的退货——事件负载应反映冲正后的数量（减去本次 quantity）
    const nextReturnedQty = Math.max(
      (await queryReturnedQuantity(this.db, lineId)) - quantity,
      0
    );
    const nextLineState = buildNextLineState(line);
    const nextOrderDeliveryStatus = await queryDerivedDeliveryStatus(this.db, orderId, -quantity);

    const reversal = await this.inventoryService.buildMutationStatements({
      type: 'order_return_cancelled',
      variantId: line.variant_id,
      quantityDelta: -quantity,
      orderId,
      orderLineId: lineId,
      referenceType: 'order_return',
      referenceId: returnId,
      metadata: {
        action: 'return_cancel',
        actorId: options.actorId || null,
        actorName: options.actorName || null,
        orderReturnId: returnId,
      },
    });

    const statements = [
      this.db
        .prepare(
          'UPDATE orders SET delivery_status = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL AND delivery_status = ?'
        )
        .bind(nextOrderDeliveryStatus, timestamp, orderId, line.delivery_status),
      buildPreviousWriteAssertionStatement(this.db),
      ...(reversal?.statements || []),
      this.db
        .prepare(
          "UPDATE order_returns SET status = 'cancelled', updated_at = ? WHERE id = ? AND order_id = ? AND order_line_id = ? AND status = 'restocked'"
        )
        .bind(timestamp, returnId, orderId, lineId),
      buildOrderTouchStatement(this.db, orderId, timestamp),
      ...buildOutboxStatements(this.domainOutboxRepo, this.uuid, {
        order: line,
        orderId,
        lineId,
        action: 'return_cancel',
        quantity,
        nextLineState,
        returnedQtyAfter: nextReturnedQty,
        timestamp,
        actorName: options.actorName || null,
      }),
    ];

    await runGuardedBatch(this.db, statements, 'order was modified concurrently');
    await this.refreshInventoryProjections(line.variant_id);
    return buildCommandResult({
      orderId,
      lineId,
      action: 'return_cancel',
      quantity,
      nextLineState,
      returnedQtyAfter: nextReturnedQty,
      inventory,
    });
  }
}
