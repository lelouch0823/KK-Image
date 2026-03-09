import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { NotificationRepository } from '../../../../../repositories/NotificationRepository.js';
import { validateProductVariantBinding } from '../../../../../api/utils/validation.js';
import { ensureOrderFolder, moveFilesToFolder } from '../../../../../api/utils/folder-utils.js';
import { generateId, generateOrderNo, triggerWebhook } from '../../../_shared/utils.js';
import { MSG, ORDER_STATUSES } from '../../../_shared/utils.js';
import { BadRequestError } from '../../../errors.js';
import {
  resolveSalesTokens,
  invalidateOrderNotificationCaches,
  scheduleOrderAndSalespersonCacheInvalidation,
} from './cache-helpers.js';

export async function createManagedOrder(c, body, user = c.get('user')) {
  const { env } = c;

  if (!body.productName || !body.salespersonId) {
    throw new BadRequestError('Product Name and Salesperson are required');
  }

  const orderRepo = new OrderRepository(env.DB);
  const orderId = generateId();
  const orderNo = generateOrderNo();
  const variantId = body.variantId ?? null;
  const notificationSalesTokens = await resolveSalesTokens(env.DB, [body.salespersonId]);

  await validateProductVariantBinding(env.DB, body.productId || null, variantId, { checkActive: true });

  if (body.status && !ORDER_STATUSES.includes(body.status)) {
    throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
  }

  await orderRepo.create({
    id: orderId,
    orderNo,
    salespersonId: body.salespersonId,
    data: {
      name: body.productName,
      brand: body.brand || '',
      series: body.series || '',
      sku: body.sku || '',
      size: body.size || '',
      color: body.color || '',
      material: body.material || '',
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

  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.filter(Boolean) : [];
  if (fileIds.length > 0) {
    try {
      const orderFolderId = await ensureOrderFolder(env, orderNo);
      await moveFilesToFolder(env, fileIds, orderFolderId);
    } catch (error) {
      console.error('Order file archiving error (manage create):', error);
    }
  }

  c.executionCtx.waitUntil((async () => {
    try {
      const notifyRepo = new NotificationRepository(env.DB);
      await notifyRepo.create({
        type: 'order',
        title: JSON.stringify({ key: 'notification.orderAssigned', params: { orderNo } }),
        content: `Order ${orderNo} has been assigned to you`,
        receiver: 'sales',
        salespersonId: body.salespersonId,
        orderId,
        metadata: { actorName: user?.name || 'Admin' },
      });

      await invalidateOrderNotificationCaches(c, { salesTokens: notificationSalesTokens });
      await triggerWebhook(env, 'order.created_by_admin', { orderId, orderNo, admin: user?.name });
    } catch (error) {
      console.error('Async notify failed:', error);
    }
  })());

  scheduleOrderAndSalespersonCacheInvalidation(c, { salesTokens: notificationSalesTokens });

  return { id: orderId, orderNo };
}
