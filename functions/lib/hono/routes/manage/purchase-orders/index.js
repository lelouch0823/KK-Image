/**
 * 采购单管理 API (Purchase Orders)
 * ==================================
 *
 * 支持采购单的创建、查询、状态变更、明细管理和成本分摊。
 * 采购单状态变更时自动级联更新关联预订单状态。
 *
 * @module routes/manage/purchase-orders
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PurchaseOrderRepository } from '../../../../../repositories/PurchaseOrderRepository.js';
import { PurchaseOrderService } from '../../../../../services/PurchaseOrderService.js';
import { DomainOutboxPublisher } from '../../../../../services/DomainOutboxPublisher.js';
import {
  validatePurchaseOrderPreOrderBinding,
  validatePurchaseOrderVariantItems,
} from '../../../../../services/purchase-order-item-validation.js';
import { NotFoundError } from '../../../errors.js';
import { withCache } from '../../../middleware/cache.js';
import { requirePermission } from '../../../middleware/auth.js';
import { requireEntity } from '../../../_shared/route-helpers.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import {
  CreatePurchaseOrderSchema,
  UpdatePurchaseOrderSchema,
  UpdatePurchaseOrderStatusSchema,
  CreateFromOrdersSchema,
} from '../../../schemas/purchase-order.js';
import {
  PURCHASE_ORDER_CREATE_COMMAND_TYPE,
  PURCHASE_ORDER_CREATE_FROM_ORDERS_COMMAND_TYPE,
  publishPurchaseOrderCacheEvent,
  requireCompletedPurchaseOrder,
  requireMutationSuccess,
  hasAllocationImpact,
  buildCreatedPurchaseOrderShell,
  buildPurchaseOrderCreateRequestFingerprint,
  buildPurchaseOrderCreateFromOrdersRequestFingerprint,
  getCreateCommandScopeKey,
  reserveCreateCommand,
} from './helpers.js';
import {
  cleanupReservedCommand,
  resolveReservationOwnership,
} from '../../../../../services/order-procurement-shared.js';
import itemsRoutes from './items.js';
import receiptsRoutes from './receipts.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/',
    domain: 'purchase-orders',
    action: 'purchase_order.create',
    severity: 'high',
    targetType: 'purchase_order',
  },
  {
    method: 'POST',
    path: '/from-orders',
    domain: 'purchase-orders',
    action: 'purchase_order.create_from_orders',
    severity: 'high',
    targetType: 'purchase_order',
  },
  {
    method: 'PUT',
    path: '/:id',
    domain: 'purchase-orders',
    action: 'purchase_order.update',
    severity: 'high',
    targetType: 'purchase_order',
  },
  {
    method: 'PATCH',
    path: '/:id/status',
    domain: 'purchase-orders',
    action: 'purchase_order.status.change',
    severity: 'high',
    targetType: 'purchase_order',
  },
  {
    method: 'POST',
    path: '/:id/allocate',
    domain: 'purchase-orders',
    action: 'purchase_order.allocate',
    severity: 'high',
    targetType: 'purchase_order',
  },
]);

app.use('*', requirePermission('products:manage'));

// Mount sub-routes
app.route('/', receiptsRoutes);
app.route('/', itemsRoutes);

// ─── 列表 & 统计 ───────────────────────────────────────

/**
 * GET / — 采购单列表
 * Query: status, page, limit
 */
app.get('/', withCache(20), async (c) => {
  const url = new URL(c.req.url);
  const filters = {
    status: url.searchParams.get('status') || '',
    page: url.searchParams.get('page') || 1,
    limit: url.searchParams.get('limit') || 20,
  };

  const repo = new PurchaseOrderRepository(c.env.DB);
  const result = await repo.list(filters);

  const totalPages = Math.ceil((result.total || 0) / (result.limit || 20));
  return c.json({
    success: true,
    data: result.items,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages,
    },
  });
});

/**
 * GET /stats — 采购统计概览
 */
app.get('/stats', withCache(30), async (c) => {
  const repo = new PurchaseOrderRepository(c.env.DB);
  const stats = await repo.getStats();
  return c.json({ success: true, data: stats });
});

/**
 * GET /suggestions — 智能采购建议
 * 基于订货总览缺口，推荐优先采购的商品及关联订单
 */
app.get('/suggestions', withCache(20), async (c) => {
  const service = new PurchaseOrderService(c.env.DB);
  const suggestions = await service.getSuggestions();
  return c.json({ success: true, data: suggestions });
});

// ─── 详情 ──────────────────────────────────────────────

/**
 * GET /:id — 采购单详情 (含明细)
 */
app.get('/:id', withCache(20), async (c) => {
  const repo = new PurchaseOrderRepository(c.env.DB);
  const po = await requireEntity(
    repo.findById(c.req.param('id')),
    () => new NotFoundError('采购单不存在')
  );

  return c.json({ success: true, data: po });
});

// ─── 创建 ──────────────────────────────────────────────

/**
 * POST / — 创建采购单 (草稿)
 * Body: { remark?, currency?, allocation_method?, estimated_shipping_cost?, estimated_tariff_cost?, items? }
 */
app.post('/', zValidator('json', CreatePurchaseOrderSchema), async (c) => {
  const body = c.req.valid('json');
  const repo = new PurchaseOrderRepository(c.env.DB);
  const requestFingerprint = buildPurchaseOrderCreateRequestFingerprint(body);
  const { replay, resume, reservation, commandIdempotencyRepo } = await reserveCreateCommand(c, {
    commandType: PURCHASE_ORDER_CREATE_COMMAND_TYPE,
    scopeKey: getCreateCommandScopeKey(c, PURCHASE_ORDER_CREATE_COMMAND_TYPE),
    requestFingerprint,
    mismatchMessage: '同一个幂等键不能提交不同的建单请求',
    inFlightMessage: '当前幂等键对应的建单命令仍在处理中',
  });

  if (replay) {
    return c.json({ success: true, data: replay }, 201);
  }

  if (resume) {
    await publishPurchaseOrderCacheEvent(c, {
      eventType: 'purchase_order_created',
      poId: resume.id,
      payload: {
        item_count: Array.isArray(body.items) ? body.items.length : 0,
      },
      commandId: reservation.record?.command_id,
      correlationId: reservation.record?.command_id,
    });
    await commandIdempotencyRepo
      .buildFinalizeStatement(reservation.record?.command_id, resume)
      .run();
    return c.json({ success: true, data: resume }, 201);
  }

  const ownsReservation = resolveReservationOwnership(reservation);
  let createdPo = null;
  let fullPo = null;

  try {
    if (body.items && body.items.length > 0) {
      await validatePurchaseOrderVariantItems(c.env.DB, body.items);
      await validatePurchaseOrderPreOrderBinding(c.env.DB, body.items);
    }

    createdPo = await repo.create({
      remark: body.remark,
      currency: body.currency,
      allocation_method: body.allocation_method,
      estimated_shipping_cost: body.estimated_shipping_cost,
      estimated_tariff_cost: body.estimated_tariff_cost,
    });

    // 如果同时传入了明细项，一并添加
    if (body.items && body.items.length > 0) {
      try {
        await repo.addItems(createdPo.id, body.items);
      } catch (error) {
        if (typeof repo.deleteIfEmptyDraft === 'function') {
          try {
            await repo.deleteIfEmptyDraft(createdPo.id);
          } catch (cleanupError) {
            console.error('Purchase-order route draft cleanup failed:', cleanupError);
          }
        }
        throw error;
      }
    }

    await publishPurchaseOrderCacheEvent(c, {
      eventType: 'purchase_order_created',
      poId: createdPo.id,
      payload: {
        item_count: Array.isArray(body.items) ? body.items.length : 0,
      },
      commandId: reservation.record?.command_id,
      correlationId: reservation.record?.command_id,
    });

    fullPo =
      (await repo.findById(createdPo.id)) || buildCreatedPurchaseOrderShell(createdPo, body.items);
    await commandIdempotencyRepo
      .buildFinalizeStatement(reservation.record?.command_id, fullPo)
      .run();

    scheduleAuditEvent(c, {
      domain: 'purchase-orders',
      action: 'purchase_order.create',
      result: 'success',
      severity: 'high',
      targetType: 'purchase_order',
      targetId: createdPo.id,
      target_label: createdPo.id,
      summary: `Created purchase order ${createdPo.id}`,
      metadata: { itemCount: Array.isArray(body.items) ? body.items.length : 0 },
    });
    return c.json({ success: true, data: fullPo }, 201);
  } catch (error) {
    if (createdPo) {
      const failedPayload =
        fullPo ||
        (await repo.findById(createdPo.id)) ||
        buildCreatedPurchaseOrderShell(createdPo, body.items);
      try {
        await commandIdempotencyRepo
          .buildFinalizeStatement(reservation.record?.command_id, failedPayload, 'failed')
          .run();
      } catch (finalizeError) {
        console.error('Purchase-order create idempotency finalize failed:', finalizeError);
      }
    } else {
      await cleanupReservedCommand({
        commandIdempotencyRepo,
        db: c.env.DB,
        ownsReservation,
        commandId: reservation.record?.command_id,
      });
    }
    throw error;
  }
});

/**
 * POST /from-orders — 从预订单快速创建采购单
 * Body: { order_ids: string[], remark?, allocation_method? }
 */
app.post('/from-orders', zValidator('json', CreateFromOrdersSchema), async (c) => {
  const body = c.req.valid('json');
  const orderIds = [...new Set((body.order_ids || []).filter(Boolean))];

  const service = new PurchaseOrderService(c.env.DB);
  const requestFingerprint = buildPurchaseOrderCreateFromOrdersRequestFingerprint(orderIds, body);
  const { replay, resume, reservation, commandIdempotencyRepo } = await reserveCreateCommand(c, {
    commandType: PURCHASE_ORDER_CREATE_FROM_ORDERS_COMMAND_TYPE,
    scopeKey: getCreateCommandScopeKey(c, PURCHASE_ORDER_CREATE_FROM_ORDERS_COMMAND_TYPE),
    requestFingerprint,
    mismatchMessage: '同一个幂等键不能提交不同的建单请求',
    inFlightMessage: '当前幂等键对应的建单命令仍在处理中',
  });

  if (replay) {
    return c.json({ success: true, data: replay }, 201);
  }

  if (resume) {
    await publishPurchaseOrderCacheEvent(c, {
      eventType: 'purchase_order_created_from_orders',
      poId: resume.id,
      payload: {
        order_ids: orderIds,
      },
      commandId: reservation.record?.command_id,
      correlationId: reservation.record?.command_id,
    });
    await commandIdempotencyRepo
      .buildFinalizeStatement(reservation.record?.command_id, resume)
      .run();
    return c.json({ success: true, data: resume }, 201);
  }

  const ownsReservation = resolveReservationOwnership(reservation);
  let po = null;

  try {
    po = await service.createFromOrders(orderIds, {
      remark: body.remark,
      allocation_method: body.allocation_method,
      estimated_shipping_cost: body.estimated_shipping_cost,
      estimated_tariff_cost: body.estimated_tariff_cost,
    });

    await publishPurchaseOrderCacheEvent(c, {
      eventType: 'purchase_order_created_from_orders',
      poId: po.id,
      payload: {
        order_ids: orderIds,
      },
      commandId: reservation.record?.command_id,
      correlationId: reservation.record?.command_id,
    });
    await commandIdempotencyRepo.buildFinalizeStatement(reservation.record?.command_id, po).run();
    scheduleAuditEvent(c, {
      domain: 'purchase-orders',
      action: 'purchase_order.create_from_orders',
      result: 'success',
      severity: 'high',
      targetType: 'purchase_order',
      targetId: po?.id,
      target_label: po?.id || null,
      summary: `Created purchase order ${po?.id || ''} from orders`,
      metadata: { orderIds },
    });

    return c.json({ success: true, data: po }, 201);
  } catch (error) {
    if (po) {
      try {
        await commandIdempotencyRepo
          .buildFinalizeStatement(reservation.record?.command_id, po, 'failed')
          .run();
      } catch (finalizeError) {
        console.error('Purchase-order from-orders idempotency finalize failed:', finalizeError);
      }
    } else {
      await cleanupReservedCommand({
        commandIdempotencyRepo,
        db: c.env.DB,
        ownsReservation,
        commandId: reservation.record?.command_id,
      });
    }
    throw error;
  }
});

// ─── 更新 ──────────────────────────────────────────────

/**
 * PUT /:id — 更新采购单基本信息
 * Body: { remark?, currency?, allocation_method?, estimated_shipping_cost?, estimated_tariff_cost?, actual_shipping_cost?, actual_tariff_cost? }
 */
app.put('/:id', zValidator('json', UpdatePurchaseOrderSchema), async (c) => {
  const body = c.req.valid('json');
  const repo = new PurchaseOrderRepository(c.env.DB);
  const currentPo = await requireEntity(
    repo.findById(c.req.param('id')),
    () => new NotFoundError('采购单不存在')
  );

  const updated = await repo.update(c.req.param('id'), body);
  requireMutationSuccess(updated, '未找到采购单或无有效字段更新');

  let po = await requireEntity(
    repo.findById(c.req.param('id')),
    () => new NotFoundError('采购单不存在')
  );
  const shouldReallocateCosts = po.status === 'completed' && hasAllocationImpact(body);
  if (shouldReallocateCosts) {
    const service = new PurchaseOrderService(c.env.DB);
    try {
      await service.allocateCosts(c.req.param('id'));
    } catch (error) {
      const rollbackPayload = Object.fromEntries(
        Object.keys(body || {}).map((field) => [field, currentPo?.[field] ?? null])
      );
      try {
        await repo.update(c.req.param('id'), rollbackPayload);
      } catch (rollbackError) {
        console.error('Purchase-order update rollback failed:', rollbackError);
      }
      throw error;
    }
    po = await requireEntity(
      repo.findById(c.req.param('id')),
      () => new NotFoundError('采购单不存在')
    );
  }

  await publishPurchaseOrderCacheEvent(c, {
    eventType: 'purchase_order_updated',
    poId: c.req.param('id'),
    payload: {
      fields: Object.keys(body || {}),
      reallocated_costs: shouldReallocateCosts,
    },
  });

  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.update',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: c.req.param('id'),
    target_label: c.req.param('id'),
    summary: `Updated purchase order ${c.req.param('id')}`,
    metadata: {
      ...body,
      reallocated_costs: shouldReallocateCosts,
    },
  });
  return c.json({ success: true, data: po });
});

/**
 * PATCH /:id/status — 变更采购单状态 (触发级联)
 * Body: { status: 'ordered' | 'shipping' | 'arrived' | 'completed' | 'cancelled' }
 */
app.patch('/:id/status', zValidator('json', UpdatePurchaseOrderStatusSchema), async (c) => {
  const body = c.req.valid('json');

  const service = new PurchaseOrderService(c.env.DB);
  // Service 内部会校验合法性并抛出 BadRequestError / NotFoundError
  const result = await service.updateStatus(c.req.param('id'), body.status);
  const publisher = new DomainOutboxPublisher(c.env.DB);
  const events = [
    {
      event_type: 'purchase_order_status_changed',
      aggregate_type: 'purchase_order',
      aggregate_id: c.req.param('id'),
      payload: {
        purchase_order_id: c.req.param('id'),
        status: body.status,
        cascaded_orders: result.cascadedOrders || 0,
      },
    },
  ];

  if (Array.isArray(result?.changedOrderStatuses) && result.changedOrderStatuses.length > 0) {
    events.push(
      ...result.changedOrderStatuses.map(({ orderId, procurementStatus }) => ({
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: orderId,
        payload: {
          purchase_order_id: c.req.param('id'),
          order_id: orderId,
          procurement_status_after: procurementStatus,
          order_procurement_status_after: procurementStatus,
          trigger: 'purchase_order_status_changed',
        },
      }))
    );
  } else if (
    result?.targetProcurementStatus &&
    Array.isArray(result?.changedOrderIds) &&
    result.changedOrderIds.length > 0
  ) {
    events.push(
      ...result.changedOrderIds.map((orderId) => ({
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: orderId,
        payload: {
          purchase_order_id: c.req.param('id'),
          order_id: orderId,
          procurement_status_after: result.targetProcurementStatus,
          order_procurement_status_after: result.targetProcurementStatus,
          trigger: 'purchase_order_status_changed',
        },
      }))
    );
  }

  await publisher.publish(events);
  c.executionCtx.waitUntil(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId: `purchase_order_status_changed:${c.req.param('id')}`,
    })
  );
  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.status.change',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: c.req.param('id'),
    target_label: c.req.param('id'),
    summary: `Changed purchase order ${c.req.param('id')} status to ${body.status}`,
    metadata: { status: body.status },
  });

  return c.json({
    success: true,
    data: {
      ...result,
      message:
        result.cascadedOrders > 0
          ? `状态已更新，同步更新了 ${result.cascadedOrders} 个预订单采购状态`
          : '状态已更新',
    },
  });
});

// ─── 成本分摊 ──────────────────────────────────────────

/**
 * POST /:id/allocate — 手动触发成本分摊 (用于填写实际费用后重新计算)
 */
app.post('/:id/allocate', async (c) => {
  const poId = c.req.param('id');
  const repo = new PurchaseOrderRepository(c.env.DB);
  const po = await requireCompletedPurchaseOrder(repo, poId, '执行成本分摊');
  const service = new PurchaseOrderService(c.env.DB);
  await service.allocateCosts(poId);

  await publishPurchaseOrderCacheEvent(c, {
    eventType: 'purchase_order_cost_allocated',
    poId,
  });

  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.allocate',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: poId,
    target_label: poId,
    summary: `Allocated costs for purchase order ${poId}`,
  });

  return c.json({ success: true, data: po });
});

export default app;
