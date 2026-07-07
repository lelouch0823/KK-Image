import { OrderCreationService } from '../../../../../services/OrderCreationService.js';
import { DomainOutboxPublisher } from '../../../../../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import { ensureOrderFolder, moveFilesToFolder } from '../../../../../api/utils/folder-utils.js';
import { scheduleCacheInvalidation } from '../../../_shared/route-helpers.js';
import { getManageOrderCacheUrls } from '../../_shared/cache-urls.js';
import { isDuplicateOutboxIdempotencyError } from '../products/idempotency-helpers.js';

export async function publishOrderCreatedByAdmin(
  c,
  { orderId, orderNo, salespersonId, actorName, commandId, correlationId } = {}
) {
  const { env } = c;
  const publisher = new DomainOutboxPublisher(env.DB);
  try {
    await publisher.publish(
      [
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
      env,
      requestUrl: c.req.url,
      workerId: `order-create:${orderId}`,
    })
  );
}

export async function completeManagedOrderCreateSideEffects(c, result = {}) {
  const { env } = c;

  // 异步失效订单列表缓存（路由层关注点）
  scheduleCacheInvalidation(c, getManageOrderCacheUrls(c));

  // 归档文件到订单目录（需要 env）
  const fileIds = Array.isArray(result.fileIds) ? result.fileIds.filter(Boolean) : [];
  if (fileIds.length > 0) {
    try {
      const orderFolderId = await ensureOrderFolder(env, result.orderNo);
      await moveFilesToFolder(env, fileIds, orderFolderId);
    } catch (error) {
      console.error('Order file archiving error (managed create):', error);
    }
  }
}

export async function createManagedOrder(c, body, user = c.get('user'), options = {}) {
  const { env } = c;
  const {
    skipOrderCreatedEvent = false,
    orderCreatedEventCommandId,
    orderCreatedEventCorrelationId,
  } = options;

  const service = new OrderCreationService(env.DB);
  const result = await service.createManagedOrder(body, user);

  await completeManagedOrderCreateSideEffects(c, result);

  // 发布领域事件（路由层关注点）
  if (!skipOrderCreatedEvent) {
    await publishOrderCreatedByAdmin(c, {
      orderId: result.id,
      orderNo: result.orderNo,
      salespersonId: result.salespersonId,
      actorName: user?.name || 'Admin',
      commandId: orderCreatedEventCommandId,
      correlationId: orderCreatedEventCorrelationId,
    });
  }

  return {
    id: result.id,
    orderNo: result.orderNo,
    salespersonId: result.salespersonId,
    fileIds: Array.isArray(result.fileIds) ? result.fileIds.filter(Boolean) : [],
  };
}
