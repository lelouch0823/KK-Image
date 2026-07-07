import { Hono } from 'hono';
import { OrderLineCommandSchema } from '../../../schemas/order.js';
import { BadRequestError, NotFoundError } from '../../../errors.js';
import { OrderLineFulfillmentService } from '../../../../../services/OrderLineFulfillmentService/index.js';
import { DomainOutboxPublisher } from '../../../../../services/DomainOutboxPublisher.js';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { parsePositiveLineCommandQuantity } from '../../../../../services/order-line-shared.js';
import { OrderTimelineRepository } from '../../../../../repositories/OrderTimelineRepository.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { scheduleOutboxProcessing } from '../../_shared/outbox-helpers.js';
import { MSG } from '../../../../../_shared/utils.js';

const app = new Hono();
const ARCHIVED_ORDER_MUTATION_MESSAGE = '订单已归档，请先恢复后再修改';

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/:id/lines/:lineId/reserve',
    domain: 'orders',
    action: 'order.line.reserve',
    severity: 'high',
    targetType: 'order',
  },
  {
    method: 'POST',
    path: '/:id/lines/:lineId/release',
    domain: 'orders',
    action: 'order.line.release',
    severity: 'high',
    targetType: 'order',
  },
  {
    method: 'POST',
    path: '/:id/lines/:lineId/ship',
    domain: 'orders',
    action: 'order.line.ship',
    severity: 'high',
    targetType: 'order',
  },
  {
    method: 'POST',
    path: '/:id/lines/:lineId/unship',
    domain: 'orders',
    action: 'order.line.unship',
    severity: 'high',
    targetType: 'order',
  },
  {
    method: 'POST',
    path: '/:id/lines/:lineId/return',
    domain: 'orders',
    action: 'order.line.return',
    severity: 'high',
    targetType: 'order',
  },
]);

function assertOrderIsActiveForMutation(order) {
  if (order?.archivedAt || order?.archived_at) {
    throw new BadRequestError(ARCHIVED_ORDER_MUTATION_MESSAGE);
  }
}

function buildTimelineComment({ action, lineId, quantity, reason = '', note = '' }) {
  if (action === 'ship') return `订单行 ${lineId} 出货 ${quantity} 件`;
  if (action === 'unship') return `订单行 ${lineId} 撤销出货 ${quantity} 件`;
  if (action === 'return') {
    const parts = [`订单行 ${lineId} 退回 ${quantity} 件`];
    if (reason) parts.push(`原因：${reason}`);
    if (note) parts.push(`备注：${note}`);
    return parts.join('，');
  }
  return '';
}

function buildFollowupDomainEvents({ action, orderId, lineId, quantity, body, actorName, order }) {
  if (action !== 'return') return [];

  const payload = {
    order_id: orderId,
    order_no: order?.orderNo || order?.order_no || '',
    order_line_id: lineId,
    salesperson_id: order?.salespersonId || order?.salesperson_id || null,
    quantity,
    reason: String(body?.reason || '').trim(),
    note: String(body?.note || '').trim(),
    actor_name: actorName || 'Admin',
  };

  return [
    {
      event_type: 'order_return_created',
      aggregate_type: 'order',
      aggregate_id: orderId,
      payload,
    },
    {
      event_type: 'order_return_restocked',
      aggregate_type: 'order',
      aggregate_id: orderId,
      payload,
    },
  ];
}

async function handleLineCommand(c, action, executor) {
  const orderId = c.req.param('id');
  const lineId = c.req.param('lineId');
  const user = c.get('user');
  let rawBody;
  try {
    rawBody = await c.req.json();
  } catch {
    throw new BadRequestError('Invalid JSON body');
  }
  // 校验请求体
  const parsed = OrderLineCommandSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.issues.map((i) => i.message).join('; '));
  }
  const body = parsed.data;
  const quantity = parsePositiveLineCommandQuantity(body);
  const payload = {
    ...body,
    quantity,
  };
  if (!['reserve', 'release', 'ship', 'unship', 'return'].includes(action)) {
    throw new Error(`Unsupported order line action: ${action}`);
  }
  const service = new OrderLineFulfillmentService(c.env.DB);
  const timelineRepo = new OrderTimelineRepository(c.env.DB);
  const publisher = new DomainOutboxPublisher(c.env.DB);
  const orderRepo = new OrderRepository(c.env.DB);
  const order = await orderRepo.findById(orderId);
  if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);
  assertOrderIsActiveForMutation(order);

  const data = await executor(service, orderId, lineId, payload, {
    actorId: user?.id || null,
    actorName: user?.name || 'Admin',
  });

  const timelineComment = buildTimelineComment({
    action,
    lineId,
    quantity,
    reason: body?.reason,
    note: body?.note,
  });
  if (timelineComment) {
    await timelineRepo.addTimelineEntry(orderId, {
      actionType: 'comment',
      actorType: 'admin',
      actorId: user?.id || null,
      actorName: user?.name || 'Admin',
      comment: timelineComment,
    });
  }

  const followupEvents = buildFollowupDomainEvents({
    action,
    orderId,
    lineId,
    quantity,
    body,
    actorName: user?.name || 'Admin',
    order: action === 'return' ? order : null,
  });
  if (followupEvents.length > 0) {
    await publisher.publish(followupEvents);
  }

  scheduleAuditEvent(c, {
    domain: 'orders',
    action:
      action === 'reserve'
        ? 'order.line.reserve'
        : action === 'release'
          ? 'order.line.release'
          : action === 'ship'
            ? 'order.line.ship'
            : action === 'unship'
              ? 'order.line.unship'
              : 'order.line.return',
    result: 'success',
    severity: 'high',
    targetType: 'order',
    targetId: orderId,
    summary: `${user?.name || 'Admin'} executed ${action} on order line ${lineId}`,
    metadata: {
      orderLineId: lineId,
      quantity,
      action,
      ...(body?.reason ? { reason: body.reason } : {}),
    },
  });
  scheduleOutboxProcessing(c, `order-line-${action}:${orderId}:${lineId}`);

  return c.json({
    success: true,
    data,
  });
}

app.post('/:id/lines/:lineId/reserve', async (c) =>
  handleLineCommand(c, 'reserve', (service, orderId, lineId, payload, options) =>
    service.reserveLine(orderId, lineId, payload, options)
  )
);

app.post('/:id/lines/:lineId/release', async (c) =>
  handleLineCommand(c, 'release', (service, orderId, lineId, payload, options) =>
    service.releaseLine(orderId, lineId, payload, options)
  )
);

app.post('/:id/lines/:lineId/ship', async (c) =>
  handleLineCommand(c, 'ship', (service, orderId, lineId, payload, options) =>
    service.shipLine(orderId, lineId, payload, options)
  )
);

app.post('/:id/lines/:lineId/unship', async (c) =>
  handleLineCommand(c, 'unship', (service, orderId, lineId, payload, options) =>
    service.unshipLine(orderId, lineId, payload, options)
  )
);

app.post('/:id/lines/:lineId/return', async (c) =>
  handleLineCommand(c, 'return', (service, orderId, lineId, payload, options) =>
    service.returnLine(orderId, lineId, payload, options)
  )
);

export default app;
