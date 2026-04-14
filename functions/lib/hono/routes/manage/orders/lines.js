import { Hono } from 'hono';
import { runOutboxPoller } from '../../../../../api/cron/outbox.js';
import { OrderLineFulfillmentService } from '../../../../../services/OrderLineFulfillmentService.js';
import { parsePositiveLineCommandQuantity } from '../../../../../services/order-line-shared.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/:id/lines/:lineId/reserve', domain: 'orders', action: 'order.line.reserve', severity: 'high', targetType: 'order' },
  { method: 'POST', path: '/:id/lines/:lineId/release', domain: 'orders', action: 'order.line.release', severity: 'high', targetType: 'order' },
  { method: 'POST', path: '/:id/lines/:lineId/ship', domain: 'orders', action: 'order.line.ship', severity: 'high', targetType: 'order' },
  { method: 'POST', path: '/:id/lines/:lineId/unship', domain: 'orders', action: 'order.line.unship', severity: 'high', targetType: 'order' },
  { method: 'POST', path: '/:id/lines/:lineId/return', domain: 'orders', action: 'order.line.return', severity: 'high', targetType: 'order' },
]);

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
  const quantity = parsePositiveLineCommandQuantity(body);
  const payload = {
    ...body,
    quantity,
  };
  const service = new OrderLineFulfillmentService(c.env.DB);

  const data = await executor(service, orderId, lineId, payload, {
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
  ));

app.post('/:id/lines/:lineId/release', async (c) =>
  handleLineCommand(c, 'release', (service, orderId, lineId, payload, options) =>
    service.releaseLine(orderId, lineId, payload, options)
  ));

app.post('/:id/lines/:lineId/ship', async (c) =>
  handleLineCommand(c, 'ship', (service, orderId, lineId, payload, options) =>
    service.shipLine(orderId, lineId, payload, options)
  ));

app.post('/:id/lines/:lineId/unship', async (c) =>
  handleLineCommand(c, 'unship', (service, orderId, lineId, payload, options) =>
    service.unshipLine(orderId, lineId, payload, options)
  ));

app.post('/:id/lines/:lineId/return', async (c) =>
  handleLineCommand(c, 'return', (service, orderId, lineId, payload, options) =>
    service.returnLine(orderId, lineId, payload, options)
  ));

export default app;
