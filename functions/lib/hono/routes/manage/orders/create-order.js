import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { validateProductVariantBinding } from '../../../../../api/utils/validation.js';
import { ensureOrderFolder, moveFilesToFolder } from '../../../../../api/utils/folder-utils.js';
import { generateId, generateOrderNo } from '../../../_shared/utils.js';
import { MSG, ORDER_STATUSES } from '../../../_shared/utils.js';
import { BadRequestError } from '../../../errors.js';
import { DemandService } from '../../../../../services/DemandService.js';
import { DomainOutboxPublisher } from '../../../../../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import { buildOrderBindingSnapshot } from '../../../../../api/utils/order-binding-snapshot.js';

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

  if (!body.productName || !body.salespersonId) {
    throw new BadRequestError('Product Name and Salesperson are required');
  }

  const orderRepo = new OrderRepository(env.DB);
  const orderId = generateId();
  const orderNo = generateOrderNo();
  const variantId = body.variantId ?? null;
  const binding = await validateProductVariantBinding(env.DB, body.productId || null, variantId, { checkActive: true });
  const boundSnapshot = buildOrderBindingSnapshot({
    product: binding.product,
    variant: binding.variant,
    fallback: {
      name: body.productName,
      brand: body.brand,
      series: body.series,
      sku: body.sku,
      size: body.size,
      color: body.color,
      material: body.material,
    },
  });

  if (body.status && !ORDER_STATUSES.includes(body.status)) {
    throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
  }

  const createdOrder = await orderRepo.create({
    id: orderId,
    orderNo,
    salespersonId: body.salespersonId,
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
    quantity: body.quantity || 1,
    status: body.status || 'pending',
    productId: body.productId || null,
    variantId,
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

  const demandService = new DemandService(env.DB);
  await demandService.syncOrderTransition({
    orderId: persistedOrderId,
    fromStatus: null,
    toStatus: body.status || 'pending',
    quantity: body.quantity || 1,
    variantId,
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

  return { id: persistedOrderId, orderNo: persistedOrderNo };
}
