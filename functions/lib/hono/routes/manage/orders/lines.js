import { Hono } from 'hono';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import { OrderLineFulfillmentService } from '../../../../../services/OrderLineFulfillmentService.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { BadRequestError } from '../../../errors.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/:id/lines/:lineId/reserve', domain: 'orders', action: 'order.line.reserve', severity: 'high', targetType: 'order' },
  { method: 'POST', path: '/:id/lines/:lineId/release', domain: 'orders', action: 'order.line.release', severity: 'high', targetType: 'order' },
  { method: 'POST', path: '/:id/lines/:lineId/ship', domain: 'orders', action: 'order.line.ship', severity: 'high', targetType: 'order' },
]);

function normalizeQuantity(body = {}) {
  const quantity = Number(body.quantity ?? body.qty ?? body.amount);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BadRequestError('quantity must be a positive number');
  }
  return Math.floor(quantity);
}

function scheduleOutboxProcessing(c, workerId) {
  c.executionCtx.waitUntil(runOutboxPoller({
    env: c.env,
    requestUrl: c.req.url,
    workerId,
  }));
}

async function handleLineCommand(c, action, executor) {
  const orderId = c.req.param('id');
  const lineId = c.req.param('lineId');
  const user = c.get('user');
  const body = await c.req.json();
  const quantity = normalizeQuantity(body);
  const service = new OrderLineFulfillmentService(c.env.DB);

  const data = await executor(service, orderId, lineId, {
    quantity,
  }, {
    actorId: user?.id || null,
    actorName: user?.name || 'Admin',
  });

  scheduleAuditEvent(c, {
    domain: 'orders',
    action: `order.line.${action}`,
    result: 'success',
    severity: action === 'ship' ? 'high' : 'normal',
    targetType: 'order',
    targetId: orderId,
    summary: `${user?.name || 'Admin'} executed ${action} on order line ${lineId}`,
    metadata: {
      orderLineId: lineId,
      quantity,
      action,
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
  ));

app.post('/:id/lines/:lineId/release', async (c) =>
  handleLineCommand(c, 'release', (service, orderId, lineId, payload, options) =>
    service.releaseLine(orderId, lineId, payload, options)
  ));

app.post('/:id/lines/:lineId/ship', async (c) =>
  handleLineCommand(c, 'ship', (service, orderId, lineId, payload, options) =>
    service.shipLine(orderId, lineId, payload, options)
  ));

export default app;
