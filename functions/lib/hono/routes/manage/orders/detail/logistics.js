import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { LogisticsUpdateSchema } from '../../../../schemas/order.js';
import { OrderRepository } from '../../../../../../repositories/OrderRepository.js';
import { MSG } from '../../../../../../_shared/utils.js';
import { BadRequestError, NotFoundError } from '../../../../errors.js';
import { requireEntity } from '../../../../_shared/route-helpers.js';
import { LogisticsService } from '../../../../../../services/LogisticsService.js';
import { scheduleAuditEvent } from '../../../../_shared/audit-helpers.js';
import { getAdminActor, assertOrderIsActiveForMutation } from './helpers.js';

const app = new Hono();

/**
 * GET /:id/logistics - 获取订单物流轨迹
 */
app.get('/:id/logistics', async (c) => {
  const { env } = c;
  const id = c.req.param('id');
  const repo = new OrderRepository(env.DB);
  const order = await requireEntity(
    repo.findById(id),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );

  // 从订单数据中提取物流信息
  const currentData = typeof order.currentData === 'object' ? order.currentData : {};
  const trackingNo = order.trackingNo || currentData.trackingNo || '';
  const carrier = order.carrier || currentData.carrier || 'express';

  const logisticsService = new LogisticsService(env.DB, { carrier });
  const tracking = await logisticsService.queryTracking(trackingNo, carrier);

  return c.json({
    success: true,
    data: {
      trackingNo,
      carrier,
      tracking,
      carriers: logisticsService.getSupportedCarriers(),
    },
  });
});

/**
 * PATCH /:id/logistics - 更新订单物流信息（运单号、快递公司）
 */
app.patch('/:id/logistics', zValidator('json', LogisticsUpdateSchema), async (c) => {
  const { env } = c;
  const user = c.get('user');
  const actor = getAdminActor(user);
  const id = c.req.param('id');
  const { trackingNo, carrier } = c.req.valid('json');

  const orderRepo = new OrderRepository(env.DB);
  const order = await requireEntity(
    orderRepo.findById(id),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );
  assertOrderIsActiveForMutation(order);

  // 更新订单的物流信息（存储在 currentData 中）
  const currentData = typeof order.currentData === 'object' ? { ...order.currentData } : {};
  currentData.trackingNo = trackingNo;
  currentData.carrier = carrier;

  const updateResult = await env.DB.prepare(
    'UPDATE orders SET current_data = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL'
  )
    .bind(JSON.stringify(currentData), Date.now(), id)
    .run();
  if ((updateResult?.meta?.changes || 0) !== 1) {
    throw new BadRequestError('订单已归档，请先恢复后再修改');
  }

  // 记录到时间轴
  await orderRepo.timelineRepo.addTimelineEntry(id, {
    actionType: 'field_updated',
    actorType: 'admin',
    actorId: actor.id,
    actorName: actor.name,
    fieldName: 'logistics',
    oldValue: JSON.stringify({ trackingNo: order.trackingNo || '', carrier: order.carrier || '' }),
    newValue: JSON.stringify({ trackingNo, carrier }),
    reason: '更新物流信息',
  });

  scheduleAuditEvent(c, {
    domain: 'orders',
    action: 'order.logistics.update',
    result: 'success',
    severity: 'normal',
    targetType: 'order',
    targetId: id,
    target_label: order.orderNo,
    summary: `${actor.name} updated logistics for order ${order.orderNo}`,
    metadata: { trackingNo, carrier },
  });

  return c.json({ success: true, message: '物流信息已更新' });
});

export default app;
