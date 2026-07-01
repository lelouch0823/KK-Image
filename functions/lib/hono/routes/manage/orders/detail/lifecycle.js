import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  AddOrderCommentSchema,
  DeliveryConfirmationSchema,
} from '../../../../schemas/order.js';
import { OrderRepository } from '../../../../../../repositories/OrderRepository.js';
import { MSG } from '../../../../../../_shared/utils.js';
import { NotFoundError, BadRequestError } from '../../../../errors.js';
import { assertAdminFull } from '../authz-helpers.js';
import { requireEntity } from '../../../../_shared/route-helpers.js';
import { OrderDeliveryService } from '../../../../../../services/OrderDeliveryService.js';
import { DomainOutboxPublisher } from '../../../../../../services/DomainOutboxPublisher.js';
import { scheduleAuditEvent } from '../../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../../_shared/audit-route-contract.js';
import {
  getAdminActor,
  assertOrderIsActiveForMutation,
  scheduleOutboxProcessing,
} from './helpers.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/:id/delivery-confirmation',
    domain: 'orders',
    action: 'order.delivery.confirm',
    severity: 'high',
    targetType: 'order',
  },
  {
    method: 'POST',
    path: '/:id/comment',
    domain: 'orders',
    action: 'order.comment.create',
    severity: 'normal',
    targetType: 'order',
  },
  {
    method: 'POST',
    path: '/:id/archive',
    domain: 'orders',
    action: 'order.archive',
    severity: 'normal',
    targetType: 'order',
  },
  {
    method: 'POST',
    path: '/:id/restore',
    domain: 'orders',
    action: 'order.restore',
    severity: 'normal',
    targetType: 'order',
  },
  {
    method: 'DELETE',
    path: '/:id',
    domain: 'orders',
    action: 'order.delete',
    severity: 'critical',
    targetType: 'order',
  },
]);

app.post(
  '/:id/delivery-confirmation',
  zValidator('json', DeliveryConfirmationSchema),
  async (c) => {
    const { env } = c;
    const user = c.get('user');
    const actor = getAdminActor(user);
    const id = c.req.param('id');
    const { note = '' } = c.req.valid('json');

    const repo = new OrderRepository(env.DB);
    const beforeOrder = await requireEntity(
      repo.findById(id),
      () => new NotFoundError(MSG.ORDER.NOT_FOUND)
    );
    assertOrderIsActiveForMutation(beforeOrder);

    const service = new OrderDeliveryService(env.DB);
    const result = await service.confirmDelivery(
      id,
      { note },
      {
        actorId: actor.id,
        actorName: actor.name,
      }
    );

    await repo.timelineRepo.addTimelineEntry(id, {
      actionType: 'field_updated',
      actorType: 'admin',
      actorId: actor.id,
      actorName: actor.name,
      fieldName: 'delivery_status',
      oldValue: beforeOrder.deliveryStatus || 'in_transit',
      newValue: 'delivered',
      reason: String(note || '').trim(),
    });

    scheduleAuditEvent(c, {
      domain: 'orders',
      action: 'order.delivery.confirm',
      result: 'success',
      severity: 'high',
      targetType: 'order',
      targetId: id,
      target_label: beforeOrder.orderNo,
      summary: `${actor.name} confirmed delivery for order ${beforeOrder.orderNo}`,
      changes_json: {
        before: { deliveryStatus: beforeOrder.deliveryStatus || 'in_transit' },
        after: { deliveryStatus: 'delivered' },
      },
      metadata: {
        note: String(note || '').trim(),
        deliveredAt: result.deliveredAt,
      },
    });

    const publisher = new DomainOutboxPublisher(env.DB);
    await publisher.publish([
      {
        event_type: 'order_delivery_confirmed',
        aggregate_type: 'order',
        aggregate_id: id,
        payload: {
          order_id: id,
          order_no: beforeOrder.orderNo,
          salesperson_id: beforeOrder.salespersonId || null,
          actor_name: actor.name,
          delivery_status: 'delivered',
          delivered_at: result.deliveredAt,
        },
      },
    ]);
    scheduleOutboxProcessing(c, `order-delivery-confirm:${id}`);

    const updatedOrder = await repo.findById(id);
    return c.json({
      success: true,
      message: 'Delivery confirmed',
      data: updatedOrder,
    });
  }
);

/**
 * POST /:id/comment - 添加订单备注/留言
 */
app.post('/:id/comment', zValidator('json', AddOrderCommentSchema), async (c) => {
  const { env } = c;
  const user = c.get('user');
  const actor = getAdminActor(user);
  const id = c.req.param('id');
  // SOTA: Payload key mismatch fix (frontend sends 'comment', backend expected 'content')
  const { comment } = c.req.valid('json');

  if (!comment) {
    throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);
  }

  const repo = new OrderRepository(env.DB);
  const order = await requireEntity(
    repo.findById(id),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );
  assertOrderIsActiveForMutation(order);

  // SOTA: Use correct method addTimelineEntry instead of add
  await repo.timelineRepo.addTimelineEntry(id, {
    actionType: 'comment',
    actorType: 'admin',
    actorId: actor.id,
    actorName: actor.name,
    comment,
  });
  await repo.setUnread(id, 'admin');

  const publisher = new DomainOutboxPublisher(env.DB);
  await publisher.publish([
    {
      event_type: 'order_comment_created_by_admin',
      aggregate_type: 'order',
      aggregate_id: id,
      payload: {
        order_id: id,
        order_no: order?.orderNo || id,
        salesperson_id: order?.salespersonId || null,
        actor_name: actor.name,
        comment,
      },
    },
  ]);
  scheduleOutboxProcessing(c, `order-comment:${id}`);
  scheduleAuditEvent(c, {
    domain: 'orders',
    action: 'order.comment.create',
    result: 'success',
    severity: 'normal',
    targetType: 'order',
    targetId: id,
    target_label: order?.orderNo || id,
    summary: `${actor.name} added a comment to order ${order?.orderNo || id}`,
    metadata: { comment },
  });
  return c.json({ success: true, message: MSG.ORDER.COMMENT_ADDED });
});

/**
 * POST /:id/archive - 归档订单（软删除）
 */
app.post('/:id/archive', async (c) => {
  const { env } = c;
  const user = c.get('user');
  const id = c.req.param('id');
  const orderRepo = new OrderRepository(env.DB);
  const order = await orderRepo.findById(id);
  if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);

  await orderRepo.archive(id, user?.id || null);

  scheduleAuditEvent(c, {
    domain: 'orders',
    action: 'order.archive',
    result: 'success',
    severity: 'normal',
    targetType: 'order',
    targetId: id,
    target_label: order.orderNo,
    summary: `${user?.name || 'Admin'} archived order ${order.orderNo}`,
  });

  return c.json({ success: true, message: '订单已归档' });
});

/**
 * POST /:id/restore - 恢复已归档订单
 */
app.post('/:id/restore', async (c) => {
  const { env } = c;
  const user = c.get('user');
  const id = c.req.param('id');
  const orderRepo = new OrderRepository(env.DB);
  const order = await orderRepo.findById(id);
  if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);

  await orderRepo.restore(id);

  scheduleAuditEvent(c, {
    domain: 'orders',
    action: 'order.restore',
    result: 'success',
    severity: 'normal',
    targetType: 'order',
    targetId: id,
    target_label: order.orderNo,
    summary: `${user?.name || 'Admin'} restored order ${order.orderNo}`,
  });

  return c.json({ success: true, message: '订单已恢复' });
});

/**
 * DELETE /:id - 彻底删除订单 (Cascading Delete)
 */
app.delete('/:id', async (c) => {
  const { env } = c;
  const user = c.get('user');
  await assertAdminFull(c, user);

  const id = c.req.param('id');
  const orderRepo = new OrderRepository(env.DB);
  const order = await orderRepo.findById(id);
  await orderRepo.deleteOrderCascading(id);
  const publisher = new DomainOutboxPublisher(env.DB);
  await publisher.publish([
    {
      event_type: 'order_deleted_by_admin',
      aggregate_type: 'order',
      aggregate_id: id,
      payload: {
        order_id: id,
        order_no: order?.orderNo || id,
        salesperson_id: order?.salespersonId || null,
        actor_name: user?.name || 'Admin',
      },
    },
  ]);
  scheduleOutboxProcessing(c, `order-delete:${id}`);
  scheduleAuditEvent(c, {
    domain: 'orders',
    action: 'order.delete',
    result: 'success',
    severity: 'critical',
    targetType: 'order',
    targetId: id,
    target_label: order?.orderNo || id,
    summary: `${user?.name || 'Admin'} deleted order ${order?.orderNo || id}`,
    metadata: { salespersonId: order?.salespersonId || null },
  });

  return c.json({ success: true, message: MSG.ORDER.DELETE_SUCCESS });
});

export default app;
