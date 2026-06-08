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
import { CommandIdempotencyRepository } from '../../../../repositories/CommandIdempotencyRepository.js';
import { PurchaseOrderRepository } from '../../../../repositories/PurchaseOrderRepository.js';
import { PurchaseOrderService } from '../../../../services/PurchaseOrderService.js';
import { OrderProcurementDomainService } from '../../../../services/OrderProcurementDomainService.js';
import { OrderProcurementReceiptReversalService } from '../../../../services/OrderProcurementReceiptReversalService.js';
import { PurchaseOrderShortageClosureService } from '../../../../services/PurchaseOrderShortageClosureService.js';
import {
  validatePurchaseOrderPreOrderBinding,
  validatePurchaseOrderUnitCost,
  validatePurchaseOrderVariantItems,
} from '../../../../services/purchase-order-item-validation.js';
import { validateOrderQuantity } from '../../../../services/purchase-order-constraints.js';
import { NotFoundError, BadRequestError } from '../../errors.js';
import { withCache } from '../../middleware/cache.js';
import { requirePermission } from '../../middleware/auth.js';
import { requireEntity } from '../../_shared/route-helpers.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { runOutboxPoller } from '../../../../api/cron/outbox.js';
import { DomainOutboxPublisher } from '../../../../services/DomainOutboxPublisher.js';
import {
  cleanupReservedCommand,
  parseStoredResponse,
  replayReservedCommand,
  resolveReservationOwnership,
} from '../../../../services/order-procurement-shared.js';
import {
  CreatePurchaseOrderSchema,
  UpdatePurchaseOrderSchema,
  UpdatePurchaseOrderStatusSchema,
  PurchaseOrderReceiptSchema,
  PurchaseOrderReceiptReversalSchema,
  ShortageClosureSchema,
  CreateFromOrdersSchema,
  AddPurchaseOrderItemsSchema,
  UpdatePurchaseOrderItemSchema,
} from '../../schemas/purchase-order.js';
import { isDuplicateOutboxIdempotencyError } from './products/idempotency-helpers.js';

const app = new Hono();
const PURCHASE_ORDER_CREATE_COMMAND_TYPE = 'purchase_order_create';
const PURCHASE_ORDER_CREATE_FROM_ORDERS_COMMAND_TYPE = 'purchase_order_create_from_orders';
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
    path: '/:id/receipts',
    domain: 'purchase-orders',
    action: 'purchase_order.receipt.create',
    severity: 'high',
    targetType: 'purchase_order',
    runtimeAssertionLevel: 'runtime',
  },
  {
    method: 'POST',
    path: '/:id/receipts/:receiptId/reversal',
    domain: 'purchase-orders',
    action: 'purchase_order.receipt.reverse',
    severity: 'critical',
    targetType: 'purchase_order',
  },
  {
    method: 'POST',
    path: '/:id/shortage-closures',
    domain: 'purchase-orders',
    action: 'purchase_order.shortage.close',
    severity: 'high',
    targetType: 'purchase_order',
  },
  {
    method: 'POST',
    path: '/:id/items',
    domain: 'purchase-orders',
    action: 'purchase_order.item.create',
    severity: 'high',
    targetType: 'purchase_order',
  },
  {
    method: 'PATCH',
    path: '/:id/items/:itemId',
    domain: 'purchase-orders',
    action: 'purchase_order.item.update',
    severity: 'high',
    targetType: 'purchase_order',
  },
  {
    method: 'DELETE',
    path: '/:id/items/:itemId',
    domain: 'purchase-orders',
    action: 'purchase_order.item.delete',
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

async function publishPurchaseOrderCacheEvent(
  c,
  { eventType, poId, payload = {}, commandId, correlationId }
) {
  const publisher = new DomainOutboxPublisher(c.env.DB);
  try {
    await publisher.publish(
      [
        {
          event_type: eventType,
          aggregate_type: 'purchase_order',
          aggregate_id: poId,
          payload: {
            purchase_order_id: poId,
            ...payload,
          },
        },
      ],
      {
        commandId,
        correlationId,
      }
    );
  } catch (error) {
    if (!isDuplicateOutboxIdempotencyError(error)) {
      throw error;
    }
  }

  c.executionCtx.waitUntil(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId: `${eventType}:${poId}`,
    })
  );
}

async function requireDraftPurchaseOrder(repo, poId, actionLabel) {
  const po = await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));
  if (po.status !== 'draft') throw new BadRequestError(`仅草稿状态允许${actionLabel}`);
  return po;
}

async function requireCompletedPurchaseOrder(repo, poId, actionLabel) {
  const po = await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));
  if (po.status !== 'completed') throw new BadRequestError(`仅已结算采购单允许${actionLabel}`);
  return po;
}

function getIdempotencyKey(c) {
  const requestKey = String(c.req.header('Idempotency-Key') || '').trim();
  return requestKey || crypto.randomUUID();
}

function requireMutationSuccess(success, message) {
  if (!success) throw new NotFoundError(message);
}

function hasAllocationImpact(body = {}) {
  const allocationFields = [
    'allocation_method',
    'estimated_shipping_cost',
    'estimated_tariff_cost',
    'actual_shipping_cost',
    'actual_tariff_cost',
  ];

  return allocationFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
}

function buildCreatedPurchaseOrderShell(po = {}, items = []) {
  return {
    ...po,
    items: Array.isArray(items) ? items.map((item) => ({ ...item })) : [],
    receipts: [],
  };
}

function normalizeScalarFingerprintValue(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function normalizeNumericFingerprintValue(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePurchaseOrderCreateItems(items = []) {
  return [...(Array.isArray(items) ? items : [])]
    .map((item = {}) => ({
      product_id: normalizeScalarFingerprintValue(item.product_id),
      variant_id: normalizeScalarFingerprintValue(item.variant_id),
      pre_order_id: normalizeScalarFingerprintValue(item.pre_order_id),
      order_line_id: normalizeScalarFingerprintValue(item.order_line_id),
      quantity: normalizeNumericFingerprintValue(item.quantity),
      unit_cost: normalizeNumericFingerprintValue(item.unit_cost),
    }))
    .sort((left, right) => {
      const keys = ['product_id', 'variant_id', 'pre_order_id', 'order_line_id'];
      for (const key of keys) {
        const compare = String(left[key] || '').localeCompare(String(right[key] || ''));
        if (compare !== 0) return compare;
      }

      const quantityCompare = Number(left.quantity || 0) - Number(right.quantity || 0);
      if (quantityCompare !== 0) return quantityCompare;
      return Number(left.unit_cost || 0) - Number(right.unit_cost || 0);
    });
}

function buildPurchaseOrderCreateRequestFingerprint(body = {}) {
  return JSON.stringify({
    remark: normalizeScalarFingerprintValue(body.remark),
    currency: normalizeScalarFingerprintValue(body.currency),
    allocation_method: normalizeScalarFingerprintValue(body.allocation_method),
    estimated_shipping_cost: normalizeNumericFingerprintValue(body.estimated_shipping_cost),
    estimated_tariff_cost: normalizeNumericFingerprintValue(body.estimated_tariff_cost),
    items: normalizePurchaseOrderCreateItems(body.items),
  });
}

function buildPurchaseOrderCreateFromOrdersRequestFingerprint(orderIds = [], body = {}) {
  return JSON.stringify({
    order_ids: [...new Set((Array.isArray(orderIds) ? orderIds : []).filter(Boolean))].sort(),
    remark: normalizeScalarFingerprintValue(body.remark),
    allocation_method: normalizeScalarFingerprintValue(body.allocation_method),
    estimated_shipping_cost: normalizeNumericFingerprintValue(body.estimated_shipping_cost),
    estimated_tariff_cost: normalizeNumericFingerprintValue(body.estimated_tariff_cost),
  });
}

function getCreateCommandScopeKey(c, suffix) {
  const actorId = String(c.get('user')?.id || 'anonymous').trim() || 'anonymous';
  return `${suffix}:${actorId}`;
}

async function reserveCreateCommand(
  c,
  { commandType, scopeKey, requestFingerprint, mismatchMessage, inFlightMessage }
) {
  const commandIdempotencyRepo = new CommandIdempotencyRepository(c.env.DB);
  const idempotencyKey = getIdempotencyKey(c);
  const reservation = await commandIdempotencyRepo.reserveCommand(
    commandType,
    scopeKey,
    idempotencyKey,
    requestFingerprint
  );

  if (reservation?.existing) {
    if (reservation.record?.request_fingerprint !== requestFingerprint) {
      throw new BadRequestError(mismatchMessage);
    }

    const storedResponse = parseStoredResponse(reservation.record?.response_json);
    if (reservation.record?.status === 'failed' && storedResponse) {
      return {
        replay: null,
        resume: storedResponse,
        reservation,
        commandIdempotencyRepo,
        idempotencyKey,
      };
    }

    return {
      replay: replayReservedCommand(reservation, requestFingerprint, {
        mismatchMessage,
        inFlightMessage,
      }),
      resume: null,
      reservation,
      commandIdempotencyRepo,
      idempotencyKey,
    };
  }

  return {
    replay: null,
    resume: null,
    reservation,
    commandIdempotencyRepo,
    idempotencyKey,
  };
}

async function validateExistingItemQuantityUpdate(db, item, nextQuantity) {
  if (!item?.variant_id || nextQuantity === undefined || nextQuantity === null) return;

  if (item?.pre_order_id) {
    const { results } = await db
      .prepare(
        `
        SELECT id, status, product_id, variant_id, quantity
        FROM orders
        WHERE id = ?
          AND archived_at IS NULL
      `
      )
      .bind(item.pre_order_id)
      .all();
    const linkedOrder = (results || [])[0] || null;

    let matchedOrderLine = null;
    if (linkedOrder?.status === 'confirmed') {
      if (item?.order_line_id) {
        const { results: lineResults } = await db
          .prepare(
            `
            SELECT id, order_id, product_id, variant_id, ordered_qty, cancelled_qty, shipped_qty
            FROM order_lines
            WHERE order_id = ? AND id = ?
          `
          )
          .bind(item.pre_order_id, item.order_line_id)
          .all();
        matchedOrderLine = (lineResults || [])[0] || null;
        if (!matchedOrderLine) {
          throw new BadRequestError('pre_order_id 与 order_line_id 不匹配');
        }
        if (
          matchedOrderLine.product_id !== item.product_id ||
          matchedOrderLine.variant_id !== item.variant_id
        ) {
          throw new BadRequestError('pre_order_id 与商品/变体不匹配');
        }
      }

      const expectedQuantity = matchedOrderLine
        ? Number.parseInt(
            String(
              Math.max(
                Number(matchedOrderLine.ordered_qty || 0) -
                  Number(matchedOrderLine.cancelled_qty || 0) -
                  Number(matchedOrderLine.shipped_qty || 0),
                0
              )
            ).trim(),
            10
          )
        : linkedOrder.product_id === item.product_id && linkedOrder.variant_id === item.variant_id
          ? Number.parseInt(String(linkedOrder.quantity ?? '').trim(), 10)
          : null;

      if (expectedQuantity !== null && Number.isFinite(expectedQuantity)) {
        const requestedQuantity = Number.parseInt(String(nextQuantity ?? '').trim(), 10);
        if (requestedQuantity !== expectedQuantity) {
          throw new BadRequestError('pre_order_id 与订单数量不匹配');
        }
      }
    }
  }

  const { results } = await db
    .prepare(
      `
    SELECT id,
           COALESCE(moq, 1) AS moq,
           COALESCE(pack_size, 1) AS pack_size,
           COALESCE(order_step, 1) AS order_step
    FROM product_variants
    WHERE id = ?
  `
    )
    .bind(item.variant_id)
    .all();
  const variant = (results || [])[0];
  if (!variant) return;

  const result = validateOrderQuantity(nextQuantity || 1, {
    moq: variant.moq,
    orderStep: variant.order_step,
    packSize: variant.pack_size,
  });
  if (!result.valid) {
    throw new BadRequestError(`${result.reason}（建议数量: ${result.suggestedQuantity}）`);
  }
}

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

/**
 * POST /:id/receipts — 采购收货 (partial receipts)
 * Body: { items: [{ purchase_order_item_id, received_qty, note? }] }
 */
app.post('/:id/receipts', zValidator('json', PurchaseOrderReceiptSchema), async (c) => {
  const poId = c.req.param('id');
  const body = c.req.valid('json');
  const idempotencyKey = getIdempotencyKey(c);

  const repo = new PurchaseOrderRepository(c.env.DB);
  await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));

  const domain = new OrderProcurementDomainService(c.env.DB);
  const result = await domain.recordPurchaseOrderReceipts(poId, body, {
    idempotencyKey,
  });
  c.executionCtx.waitUntil(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId: `request:${poId}:${idempotencyKey}`,
    })
  );

  return c.json({ success: true, data: result }, 201);
});

app.post(
  '/:id/receipts/:receiptId/reversal',
  zValidator('json', PurchaseOrderReceiptReversalSchema),
  async (c) => {
    const poId = c.req.param('id');
    const receiptId = c.req.param('receiptId');
    const body = c.req.valid('json');
    const idempotencyKey = getIdempotencyKey(c);

    const repo = new PurchaseOrderRepository(c.env.DB);
    await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));

    const reversalService = new OrderProcurementReceiptReversalService(c.env.DB);
    const result = await reversalService.reverseReceipt(poId, receiptId, body, {
      idempotencyKey,
    });
    scheduleAuditEvent(c, {
      domain: 'purchase-orders',
      action: 'purchase_order.receipt.reverse',
      result: 'success',
      severity: 'critical',
      targetType: 'purchase_order',
      targetId: poId,
      target_label: poId,
      summary: `Reversed receipt ${receiptId} for purchase order ${poId}`,
      metadata: {
        receiptId,
        reversalId: result?.reversal_id || null,
        reversalQty: result?.reversal_qty || null,
      },
    });
    c.executionCtx.waitUntil(
      runOutboxPoller({
        env: c.env,
        requestUrl: c.req.url,
        workerId: `reversal:${poId}:${receiptId}:${idempotencyKey}`,
      })
    );

    return c.json({ success: true, data: result }, 201);
  }
);

app.post('/:id/shortage-closures', zValidator('json', ShortageClosureSchema), async (c) => {
  const poId = c.req.param('id');
  const body = c.req.valid('json');
  const idempotencyKey = getIdempotencyKey(c);

  const repo = new PurchaseOrderRepository(c.env.DB);
  await requireEntity(repo.findById(poId), () => new NotFoundError('采购单不存在'));

  const shortageClosureService = new PurchaseOrderShortageClosureService(c.env.DB);
  const result = await shortageClosureService.closeShortages(poId, body, {
    idempotencyKey,
  });

  const publisher = new DomainOutboxPublisher(c.env.DB);
  const events = [
    {
      event_type: 'purchase_order_updated',
      aggregate_type: 'purchase_order',
      aggregate_id: poId,
      payload: {
        purchase_order_id: poId,
        shortage_closed_count: result?.closed_count || 0,
        shortage_closed_items: Array.isArray(result?.items) ? result.items.length : 0,
      },
    },
  ];
  if (
    Array.isArray(result?.changedOrderProgressions) &&
    result.changedOrderProgressions.length > 0
  ) {
    events.push(
      ...result.changedOrderProgressions.map((progression) => ({
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: progression.orderId,
        payload: {
          purchase_order_id: poId,
          order_id: progression.orderId,
          order_line_id: progression.orderLineId,
          order_line_display_status_after: progression.orderLineDisplayStatus,
          procurement_status_after: progression.procurementStatus,
          order_procurement_status_after: progression.procurementStatus,
          trigger: 'purchase_order_shortage_closed',
        },
      }))
    );
  } else if (
    Array.isArray(result?.changedOrderStatuses) &&
    result.changedOrderStatuses.length > 0
  ) {
    events.push(
      ...result.changedOrderStatuses.map(({ orderId, procurementStatus }) => ({
        event_type: 'order_procurement_progressed',
        aggregate_type: 'order',
        aggregate_id: orderId,
        payload: {
          purchase_order_id: poId,
          order_id: orderId,
          procurement_status_after: procurementStatus,
          order_procurement_status_after: procurementStatus,
          trigger: 'purchase_order_shortage_closed',
        },
      }))
    );
  }
  await publisher.publish(events);
  c.executionCtx.waitUntil(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId: `purchase_order_shortage_closed:${poId}:${idempotencyKey}`,
    })
  );
  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.shortage.close',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: poId,
    target_label: poId,
    summary: `Closed purchase order shortages for ${poId}`,
    metadata: {
      closedCount: result?.closed_count || 0,
      items: result?.items || [],
    },
  });

  return c.json({ success: true, data: result }, 201);
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

// ─── 明细操作 ──────────────────────────────────────────

/**
 * POST /:id/items — 添加明细
 * Body: { items: [{ product_id, pre_order_id?, quantity, unit_cost }] }
 */
app.post('/:id/items', zValidator('json', AddPurchaseOrderItemsSchema), async (c) => {
  const poId = c.req.param('id');
  const body = c.req.valid('json');
  const repo = new PurchaseOrderRepository(c.env.DB);

  // 校验采购单存在且为草稿状态
  await requireDraftPurchaseOrder(repo, poId, '添加明细');

  if (!body.items || body.items.length === 0) {
    throw new BadRequestError('请提供至少一条明细项');
  }
  await validatePurchaseOrderVariantItems(c.env.DB, body.items);
  await validatePurchaseOrderPreOrderBinding(c.env.DB, body.items, { currentPoId: poId, repo });

  const ids = await repo.addItems(poId, body.items);

  await publishPurchaseOrderCacheEvent(c, {
    eventType: 'purchase_order_item_created',
    poId,
    payload: {
      item_count: ids.length,
    },
  });
  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.item.create',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: poId,
    target_label: poId,
    summary: `Added ${ids.length} items to purchase order ${poId}`,
    metadata: { count: ids.length },
  });

  return c.json({ success: true, data: { created: ids.length } }, 201);
});

/**
 * PATCH /:id/items/:itemId — 更新单条明细（数量/单价）
 * Body: { quantity?, unit_cost? }
 */
app.patch('/:id/items/:itemId', zValidator('json', UpdatePurchaseOrderItemSchema), async (c) => {
  const poId = c.req.param('id');
  const body = c.req.valid('json');
  const repo = new PurchaseOrderRepository(c.env.DB);

  // 校验采购单存在且为草稿状态
  await requireDraftPurchaseOrder(repo, poId, '修改明细');

  if (body.variant_id !== undefined) {
    throw new BadRequestError('现有采购明细不允许修改规格，请删除后重新添加');
  }

  const existingItem = await repo.findItemById(poId, c.req.param('itemId'));
  if (!existingItem) {
    throw new NotFoundError('明细不存在');
  }

  validatePurchaseOrderUnitCost(body.unit_cost);
  await validateExistingItemQuantityUpdate(c.env.DB, existingItem, body.quantity);

  const updated = await repo.updateItem(poId, c.req.param('itemId'), body);
  requireMutationSuccess(updated, '明细不存在');

  await publishPurchaseOrderCacheEvent(c, {
    eventType: 'purchase_order_item_updated',
    poId,
    payload: {
      item_id: c.req.param('itemId'),
      fields: Object.keys(body || {}),
    },
  });
  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.item.update',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: poId,
    target_label: poId,
    summary: `Updated purchase order item ${c.req.param('itemId')}`,
    metadata: body,
  });

  return c.json({ success: true });
});

/**
 * DELETE /:id/items/:itemId — 删除明细
 */
app.delete('/:id/items/:itemId', async (c) => {
  const poId = c.req.param('id');
  const repo = new PurchaseOrderRepository(c.env.DB);

  // 校验采购单状态
  await requireDraftPurchaseOrder(repo, poId, '删除明细');

  const removed = await repo.removeItem(poId, c.req.param('itemId'));
  requireMutationSuccess(removed, '明细不存在');

  await publishPurchaseOrderCacheEvent(c, {
    eventType: 'purchase_order_item_deleted',
    poId,
    payload: {
      item_id: c.req.param('itemId'),
    },
  });
  scheduleAuditEvent(c, {
    domain: 'purchase-orders',
    action: 'purchase_order.item.delete',
    result: 'success',
    severity: 'high',
    targetType: 'purchase_order',
    targetId: poId,
    target_label: poId,
    summary: `Deleted purchase order item ${c.req.param('itemId')}`,
  });

  return c.json({ success: true });
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
