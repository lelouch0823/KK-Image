import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { UpdateAdminOrderSchema, UpdateOrderStatusSchema } from '../../../../schemas/order.js';
import { OrderRepository } from '../../../../../../repositories/OrderRepository.js';
import { validateProductVariantBinding } from '../../../../../../api/utils/validation.js';
import { MSG, ORDER_STATUSES } from '../../../../../../_shared/utils.js';
import { NotFoundError, BadRequestError } from '../../../../errors.js';
import { requireEntity } from '../../../../_shared/route-helpers.js';
import { isInsufficientStockError, isInvalidStatusTransitionError } from '../error-helpers.js';
import { DemandService } from '../../../../../../services/DemandService.js';
import { DomainOutboxPublisher } from '../../../../../../services/DomainOutboxPublisher.js';
import {
  syncOrderDemandTransitions,
  syncOrderDemandTransitionsByLines,
} from '../../../../../../api/utils/order-demand-sync.js';
import { buildOrderBindingSnapshot } from '../../../../../../api/utils/order-binding-snapshot.js';
import { scheduleAuditEvent } from '../../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../../_shared/audit-route-contract.js';
import {
  ADMIN_EDITABLE_FIELDS,
  STRUCTURAL_EDITABLE_STATUSES,
  QUANTITY_EDITABLE_STATUSES,
  ORDER_BOUND_SNAPSHOT_FIELDS,
  getAdminActor,
  assertOrderIsActiveForMutation,
  assertStatusTransitionAllowed,
  scheduleOutboxProcessing,
  hydrateEditableLines,
} from './helpers.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'PATCH',
    path: '/:id',
    domain: 'orders',
    action: 'order.update',
    severity: 'high',
    targetType: 'order',
  },
  {
    method: 'PATCH',
    path: '/:id/status',
    domain: 'orders',
    action: 'order.status.change',
    severity: 'high',
    targetType: 'order',
  },
]);

/**
 * PATCH /:id - 修改订单
 */
app.patch('/:id', zValidator('json', UpdateAdminOrderSchema), async (c) => {
  const { env } = c;
  const user = c.get('user'); // 从 JWT 获取管理员信息
  const actor = getAdminActor(user);
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const orderRepo = new OrderRepository(env.DB);
  const order = await requireEntity(
    orderRepo.findById(id),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );
  assertOrderIsActiveForMutation(order);

  const { updates: updatesFromBody, reason, fileIds, productId, variantId } = body;
  const forceStatusTransition = Boolean(body?.force);
  const updatesObj = updatesFromBody || body;
  const {
    reason: _unusedReason,
    fileIds: _unusedFileIds,
    updates: _unusedUpdates,
    productId: _unusedProductId,
    variantId: _unusedVariantId,
    ...updates
  } = updatesObj;

  const { processOrderUpdate } = await import('../../../../../../api/utils/order-utils.js');

  // 如果绑定了商品，从商品库获取信息覆盖提交的字段
  let finalUpdates = { ...updates };
  const rawLines = Array.isArray(updates.lines) ? updates.lines.filter(Boolean) : null;
  let normalizedLines = null;
  let payloadProductId = productId;
  let payloadVariantId = variantId;

  if (rawLines) {
    if (rawLines.length === 0) {
      throw new BadRequestError('lines must include at least one item');
    }
    normalizedLines = await hydrateEditableLines(env.DB, rawLines);
    const primaryLine = normalizedLines[0];
    const totalQuantity = normalizedLines.reduce((sum, line) => sum + line.quantity, 0);
    finalUpdates = {
      ...finalUpdates,
      name: primaryLine.name,
      brand: primaryLine.brand,
      category: primaryLine.category,
      series: primaryLine.series,
      sku: primaryLine.sku,
      size: primaryLine.size,
      color: primaryLine.color,
      material: primaryLine.material,
      remark: primaryLine.remark || finalUpdates.remark || '',
      deadline: primaryLine.deadline || finalUpdates.deadline || '',
      quantity: totalQuantity,
      lines: normalizedLines,
    };

    if (normalizedLines.length === 1) {
      if (payloadProductId === undefined) payloadProductId = primaryLine.productId ?? null;
      if (payloadVariantId === undefined) payloadVariantId = primaryLine.variantId ?? null;
    } else if (normalizedLines.length > 1) {
      if (payloadProductId === undefined) payloadProductId = null;
      if (payloadVariantId === undefined) payloadVariantId = null;
    }
  }

  const hasProductIdPayload = payloadProductId !== undefined;
  const hasVariantIdPayload = payloadVariantId !== undefined;
  const hasBindingMutation = hasProductIdPayload || hasVariantIdPayload;
  const hasQuantityMutation = updates.quantity !== undefined;
  const hasLineMutation = Boolean(normalizedLines);
  const effectiveProductId = hasProductIdPayload ? payloadProductId : order.productId;
  const hasExistingBinding = Boolean(order.productId && order.variantId);
  let normalizedVariantId = hasVariantIdPayload ? payloadVariantId || null : undefined;
  let validatedBinding = null;

  if (
    hasBindingMutation &&
    !STRUCTURAL_EDITABLE_STATUSES.has(
      String(order.status || '')
        .trim()
        .toLowerCase()
    )
  ) {
    throw new BadRequestError(
      'product binding can only be changed while order is pending, rejected, or void'
    );
  }
  if (
    hasLineMutation &&
    !STRUCTURAL_EDITABLE_STATUSES.has(
      String(order.status || '')
        .trim()
        .toLowerCase()
    )
  ) {
    throw new BadRequestError(
      'order lines can only be changed while order is pending, rejected, or void'
    );
  }
  if (
    hasQuantityMutation &&
    !QUANTITY_EDITABLE_STATUSES.has(
      String(order.status || '')
        .trim()
        .toLowerCase()
    )
  ) {
    throw new BadRequestError(
      'quantity can only be changed while order is pending, confirmed, rejected, or void'
    );
  }

  if (hasExistingBinding && !hasBindingMutation) {
    for (const field of ORDER_BOUND_SNAPSHOT_FIELDS) {
      delete finalUpdates[field];
    }
  }

  if (hasBindingMutation) {
    validatedBinding = await validateProductVariantBinding(
      env.DB,
      effectiveProductId,
      normalizedVariantId,
      { checkActive: true }
    );
    normalizedVariantId = validatedBinding.normalizedVariantId;
    const boundSnapshot = buildOrderBindingSnapshot({
      product: validatedBinding.product,
      variant: validatedBinding.variant,
      fallback: finalUpdates,
    });
    finalUpdates.name = boundSnapshot.name;
    finalUpdates.brand = boundSnapshot.brand;
    finalUpdates.category = boundSnapshot.category;
    finalUpdates.series = boundSnapshot.series;
    finalUpdates.sku = boundSnapshot.sku;
    finalUpdates.size = boundSnapshot.size;
    finalUpdates.color = boundSnapshot.color;
    finalUpdates.material = boundSnapshot.material;
  }

  const requestedStatus = finalUpdates?.status;
  await assertStatusTransitionAllowed({
    c,
    user,
    fromStatus: order.status,
    toStatus: requestedStatus,
    forceStatusTransition,
    reason,
  });

  const updateResult = await processOrderUpdate({
    env,
    orderId: id,
    orderNo: order.orderNo,
    currentData: order.currentData,
    currentStatus: order.status,
    updates: finalUpdates,
    fileIds,
    productId: payloadProductId,
    variantId: normalizedVariantId,
    currentProductId: order.productId,
    currentVariantId: order.variantId,
    currentSalespersonId: order.salespersonId,
    allowedFields: ADMIN_EDITABLE_FIELDS,
    actor: { type: 'admin', id: actor.id, name: actor.name },
    reason: reason || 'Admin Update',
    salespersonId: updates.salespersonId ?? order.salespersonId, // 传入销售员ID以发送通知
    salespersonIdUpdate: updates.salespersonId,
    forceStatusTransition,
    deferNotifications: true,
  });

  if (updateResult?.outboxEvents?.length) {
    const publisher = new DomainOutboxPublisher(env.DB);
    await publisher.publish(updateResult.outboxEvents);
    scheduleOutboxProcessing(c, `order-update:${id}`);
  }

  let updatedOrder = null;
  const nextStatus = finalUpdates?.status ?? order.status;
  const nextVariantId = hasVariantIdPayload ? normalizedVariantId : order.variantId;
  const nextQuantity = finalUpdates?.quantity ?? order.quantity;
  const demandService = new DemandService(env.DB);
  const hasMultiLineDemandContext =
    (Array.isArray(order.lines) && order.lines.length > 1) ||
    (Array.isArray(normalizedLines) && normalizedLines.length > 1);
  if (hasMultiLineDemandContext) {
    updatedOrder = await orderRepo.findById(id);
    const persistedNextLines =
      Array.isArray(updatedOrder?.lines) && updatedOrder.lines.length > 0
        ? updatedOrder.lines
        : normalizedLines || order.lines || [];
    const persistedNextStatus = updatedOrder?.status ?? nextStatus;
    const persistedNextProductId =
      updatedOrder?.productId ?? (hasProductIdPayload ? payloadProductId : order.productId);
    const persistedNextVariantId = updatedOrder?.variantId ?? nextVariantId;
    const persistedNextQuantity = updatedOrder?.quantity ?? nextQuantity;
    await syncOrderDemandTransitionsByLines(demandService, {
      orderId: id,
      previousStatus: order.status,
      nextStatus: persistedNextStatus,
      previousLines: order.lines || [],
      nextLines: persistedNextLines,
      previousFallback: {
        productId: order.productId,
        variantId: order.variantId,
        quantity: order.quantity,
      },
      nextFallback: {
        productId: persistedNextProductId,
        variantId: persistedNextVariantId,
        quantity: persistedNextQuantity,
      },
    });
  } else {
    await syncOrderDemandTransitions(demandService, {
      orderId: id,
      previousStatus: order.status,
      nextStatus,
      previousQuantity: order.quantity,
      nextQuantity,
      previousVariantId: order.variantId,
      nextVariantId,
    });
  }

  updatedOrder = updatedOrder || (await orderRepo.findById(id));
  scheduleAuditEvent(c, {
    domain: 'orders',
    action: 'order.update',
    result: 'success',
    severity: forceStatusTransition ? 'high' : 'normal',
    targetType: 'order',
    targetId: id,
    target_label: order.orderNo,
    summary: `${actor.name} updated order ${order.orderNo}`,
    changes_json: {
      before: { status: order.status },
      after: { status: updatedOrder?.status ?? nextStatus },
    },
    metadata: { reason: reason || 'Admin Update', force: forceStatusTransition },
  });
  return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS, data: updatedOrder });
});

/**
 * PATCH /:id/status - 更新订单状态
 */
app.patch('/:id/status', zValidator('json', UpdateOrderStatusSchema), async (c) => {
  const { env } = c;
  const user = c.get('user');
  const actor = getAdminActor(user);
  const id = c.req.param('id');
  const { status, note, force } = c.req.valid('json');
  if (!ORDER_STATUSES.includes(status)) {
    throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
  }

  const repo = new OrderRepository(env.DB);
  const order = await requireEntity(
    repo.findById(id),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );
  assertOrderIsActiveForMutation(order);

  const oldStatus = order.status;
  const forceStatusTransition = Boolean(force);
  await assertStatusTransitionAllowed({
    c,
    user,
    fromStatus: oldStatus,
    toStatus: status,
    forceStatusTransition,
    reason: note,
  });

  let success = false;
  try {
    success = await repo.updateStatus(id, status, 'admin', { forceStatusTransition });
  } catch (error) {
    if (isInsufficientStockError(error)) {
      throw new BadRequestError('Insufficient stock: cannot mark order as delivered');
    }
    if (isInvalidStatusTransitionError(error)) {
      throw new BadRequestError(`Invalid status transition: ${oldStatus} -> ${status}`);
    }
    throw error;
  }

  if (success) {
    const demandService = new DemandService(env.DB);
    if (Array.isArray(order.lines) && order.lines.length > 1) {
      await syncOrderDemandTransitionsByLines(demandService, {
        orderId: id,
        previousStatus: oldStatus,
        nextStatus: status,
        previousLines: order.lines,
        nextLines: order.lines,
        previousFallback: {
          productId: order.productId,
          variantId: order.variantId,
          quantity: order.quantity,
        },
        nextFallback: {
          productId: order.productId,
          variantId: order.variantId,
          quantity: order.quantity,
        },
      });
    } else {
      await demandService.syncOrderTransition({
        orderId: id,
        fromStatus: oldStatus,
        toStatus: status,
        quantity: order.quantity,
        variantId: order.variantId,
      });
    }

    // 记录状态变更到时间轴
    await repo.timelineRepo.addTimelineEntry(id, {
      actionType: 'status_changed',
      actorType: 'admin',
      actorId: actor.id,
      actorName: actor.name,
      oldValue: oldStatus,
      newValue: status,
      reason: note || '',
    });

    const publisher = new DomainOutboxPublisher(env.DB);
    await publisher.publish([
      {
        event_type: 'order_status_changed_by_admin',
        aggregate_type: 'order',
        aggregate_id: id,
        payload: {
          order_id: id,
          order_no: order.orderNo,
          salesperson_id: order.salespersonId || null,
          actor_name: actor.name,
          status,
          force: forceStatusTransition,
        },
      },
    ]);
    scheduleOutboxProcessing(c, `order-status:${id}:${status}`);
  } else {
    throw new BadRequestError(MSG.COMMON.OP_FAILED);
  }

  scheduleAuditEvent(c, {
    domain: 'orders',
    action: forceStatusTransition ? 'order.status.force_change' : 'order.status.change',
    result: 'success',
    severity: forceStatusTransition ? 'high' : 'normal',
    targetType: 'order',
    targetId: id,
    target_label: order.orderNo,
    summary: `${actor.name} changed order ${order.orderNo} status to ${status}`,
    changes_json: { before: { status: oldStatus }, after: { status } },
    metadata: { force: forceStatusTransition, note: note || '' },
  });
  return c.json({ success: true, message: MSG.ORDER.STATUS_CHANGED });
});

export default app;
