import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { validateProductVariantBinding } from '../../../../../api/utils/validation.js';
import { ensureOrderFolder, moveFilesToFolder } from '../../../../../api/utils/folder-utils.js';
import { generateId, generateOrderNo } from '../../../../../_shared/utils.js';
import { MSG, ORDER_STATUSES } from '../../../../../_shared/utils.js';
import { BadRequestError } from '../../../errors.js';
import { DemandService } from '../../../../../services/DemandService.js';
import { DomainOutboxPublisher } from '../../../../../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import { buildOrderBindingSnapshot } from '../../../../../api/utils/order-binding-snapshot.js';
import { syncOrderDemandTransitionsByLines } from '../../../../../api/utils/order-demand-sync.js';
import { canTransitionOrderStatus, normalizeOrderStatus } from '../../../../../api/utils/order-state-machine.js';

function isDuplicateOutboxIdempotencyError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('unique constraint failed')
    && (
      message.includes('domain_outbox.idempotency_key')
      || message.includes('idx_domain_outbox_idempotency_key')
    )
  );
}

function isCreatableManagedOrderStatus(status) {
  if (!status) return true;
  const normalizedStatus = normalizeOrderStatus(status);
  return normalizedStatus === 'pending' || canTransitionOrderStatus('pending', normalizedStatus);
}

function attachPartialResult(error, partialResult) {
  if (!error || typeof error !== 'object') {
    return Object.assign(new Error(String(error || 'Order create failed')), { partialResult });
  }
  if (!error.partialResult) {
    error.partialResult = partialResult;
  }
  return error;
}

export async function publishOrderCreatedByAdmin(c, {
  orderId,
  orderNo,
  salespersonId,
  actorName,
  commandId,
  correlationId,
} = {}) {
  const { env } = c;
  const publisher = new DomainOutboxPublisher(env.DB);
  try {
    await publisher.publish([
      {
        event_type: 'order_created_by_admin',
        aggregate_type: 'order',
        aggregate_id: orderId,
        payload: {
          order_id: orderId,
          order_no: orderNo,
          salesperson_id: salespersonId,
          actor_name: actorName,
        },
      },
    ], {
      commandId,
      correlationId,
    });
  } catch (error) {
    if (!isDuplicateOutboxIdempotencyError(error)) {
      throw error;
    }
  }

  c.executionCtx.waitUntil(runOutboxPoller({
    env,
    requestUrl: c.req.url,
    workerId: `order-create:${orderId}`,
  }));
}

export async function createManagedOrder(c, body, user = c.get('user'), options = {}) {
  const { env } = c;
  const {
    skipOrderCreatedEvent = false,
    orderCreatedEventCommandId,
    orderCreatedEventCorrelationId,
  } = options;

  const rawLines = Array.isArray(body.lines) ? body.lines.filter(Boolean) : [];
  if ((!body.productName && rawLines.length === 0) || !body.salespersonId) {
    throw new BadRequestError('Product Name and Salesperson are required');
  }

  const orderRepo = new OrderRepository(env.DB);
  const orderId = generateId();
  const orderNo = generateOrderNo();
  const normalizedLines = rawLines.map((line) => ({
    name: String(line.name || line.productName || '').trim(),
    brand: String(line.brand || '').trim(),
    category: String(line.category || '').trim(),
    series: String(line.series || '').trim(),
    sku: String(line.sku || '').trim(),
    size: String(line.size || '').trim(),
    color: String(line.color || '').trim(),
    material: String(line.material || '').trim(),
    remark: String(line.remark || '').trim(),
    deadline: String(line.deadline || '').trim(),
    quantity: Math.max(1, Math.trunc(Number(line.quantity || 1))),
    productId: line.productId || null,
    variantId: line.variantId ?? null,
  }));
  const hydratedLines = [];
  for (const line of normalizedLines) {
    const binding = await validateProductVariantBinding(
      env.DB,
      line.productId || null,
      line.variantId ?? null,
      { checkActive: true }
    );
    const boundSnapshot = buildOrderBindingSnapshot({
      product: binding.product,
      variant: binding.variant,
      fallback: line,
    });
    hydratedLines.push({
      ...line,
      name: boundSnapshot.name,
      brand: boundSnapshot.brand,
      category: boundSnapshot.category,
      series: boundSnapshot.series,
      sku: boundSnapshot.sku,
      size: boundSnapshot.size,
      color: boundSnapshot.color,
      material: boundSnapshot.material,
      productId: binding.normalizedProductId,
      variantId: binding.normalizedVariantId,
    });
  }
  const primaryLine = hydratedLines[0] || null;
  const variantId = primaryLine ? (primaryLine.variantId ?? null) : (body.variantId ?? null);
  const binding = await validateProductVariantBinding(
    env.DB,
    primaryLine ? (primaryLine.productId || null) : (body.productId || null),
    variantId,
    { checkActive: true }
  );
  const boundSnapshot = buildOrderBindingSnapshot({
    product: binding.product,
    variant: binding.variant,
    fallback: primaryLine || {
      name: body.productName,
      brand: body.brand,
      category: body.category,
      series: body.series,
      sku: body.sku,
      size: body.size,
      color: body.color,
      material: body.material,
    },
  });
  const totalQuantity = hydratedLines.length > 0
    ? hydratedLines.reduce((sum, line) => sum + line.quantity, 0)
    : (body.quantity || 1);

  if (body.status && !ORDER_STATUSES.includes(body.status)) {
    throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
  }
  if (body.status && !isCreatableManagedOrderStatus(body.status)) {
    throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
  }

  const nextStatus = body.status || 'pending';

  const createdOrder = await orderRepo.create({
    id: orderId,
    orderNo,
        salespersonId: body.salespersonId,
        customerId: body.customerId || null,
        data: {
          name: boundSnapshot.name,
      brand: boundSnapshot.brand,
      category: boundSnapshot.category,
      series: boundSnapshot.series,
      sku: boundSnapshot.sku,
      size: boundSnapshot.size,
      color: boundSnapshot.color,
          material: boundSnapshot.material,
          remark: body.remark || '',
          deadline: body.deadline || '',
        },
        quantity: totalQuantity,
        status: nextStatus,
        productId: hydratedLines.length > 1 ? null : (primaryLine?.productId || body.productId || null),
        variantId: hydratedLines.length > 1 ? null : variantId,
        lines: hydratedLines,
        mainImageId: body.fileIds?.[0] || null,
        fileIds: body.fileIds || [],
        timeline: {
      actionType: 'created',
      actorType: 'admin',
      actorId: user?.id || 'admin',
      actorName: user?.name || 'Admin',
      comment: 'Admin created order',
    },
  });
  const persistedOrderId = createdOrder?.id || orderId;
  const persistedOrderNo = createdOrder?.orderNo || orderNo;
  const result = { id: persistedOrderId, orderNo: persistedOrderNo };

  try {
    const persistedOrderDetail = typeof orderRepo.findById === 'function'
      ? await orderRepo.findById(persistedOrderId)
      : null;
    const persistedLines = Array.isArray(persistedOrderDetail?.lines) ? persistedOrderDetail.lines : [];
    const demandLines = persistedLines.length > 0 ? persistedLines : hydratedLines;
    const demandPrimaryLine = demandLines[0] || primaryLine;

    const demandService = new DemandService(env.DB);
    await syncOrderDemandTransitionsByLines(demandService, {
      orderId: persistedOrderId,
      previousStatus: null,
      nextStatus,
      previousLines: [],
      nextLines: demandLines,
      previousFallback: {},
      nextFallback: {
        productId: demandLines.length === 1 ? (demandPrimaryLine?.productId || body.productId || null) : null,
        variantId: demandLines.length === 1 ? (demandPrimaryLine?.variantId ?? variantId) : null,
        quantity: totalQuantity,
      },
    });

    const fileIds = Array.isArray(body.fileIds) ? body.fileIds.filter(Boolean) : [];
    if (fileIds.length > 0) {
      try {
        const orderFolderId = await ensureOrderFolder(env, persistedOrderNo);
        await moveFilesToFolder(env, fileIds, orderFolderId);
      } catch (error) {
        console.error('Order file archiving error (manage create):', error);
      }
    }

    if (!skipOrderCreatedEvent) {
      await publishOrderCreatedByAdmin(c, {
        orderId: persistedOrderId,
        orderNo: persistedOrderNo,
        salespersonId: body.salespersonId,
        actorName: user?.name || 'Admin',
        commandId: orderCreatedEventCommandId,
        correlationId: orderCreatedEventCorrelationId,
      });
    }
  } catch (error) {
    throw attachPartialResult(error, result);
  }

  return result;
}
