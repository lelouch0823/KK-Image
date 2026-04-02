import { Hono } from 'hono';
import { WebhookRepository } from '../../../../repositories/WebhookRepository.js';
import { DOMAIN_EVENT_CATALOG } from '../../../../services/DomainEventCatalog.js';
import { generateHmacSignature, MSG } from '../../_shared/utils.js';
import { NotFoundError, BadRequestError } from '../../errors.js';
import { requirePermission } from '../../middleware/auth.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { requireEntity } from '../../_shared/route-helpers.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/',
    domain: 'webhooks',
    action: 'webhook.create',
    severity: 'critical',
    targetType: 'webhook',
    runtimeAssertionLevel: 'runtime',
    highRisk: true,
  },
  {
    method: 'PUT',
    path: '/:id',
    domain: 'webhooks',
    action: 'webhook.update',
    severity: 'critical',
    targetType: 'webhook',
    runtimeAssertionLevel: 'runtime',
    highRisk: true,
  },
  {
    method: 'DELETE',
    path: '/:id',
    domain: 'webhooks',
    action: 'webhook.delete',
    severity: 'critical',
    targetType: 'webhook',
    runtimeAssertionLevel: 'runtime',
    highRisk: true,
  },
  {
    method: 'POST',
    path: '/:id/test',
    domain: 'webhooks',
    action: 'webhook.test',
    severity: 'high',
    targetType: 'webhook',
    runtimeAssertionLevel: 'runtime',
  },
]);

function getSupportedEvents() {
  return Object.entries(DOMAIN_EVENT_CATALOG)
    .filter(([, definition]) => Array.isArray(definition?.consumers) && definition.consumers.includes('webhook'))
    .map(([eventType]) => eventType);
}

function validateEvents(events = []) {
  const supportedEvents = getSupportedEvents();
  const invalid = (events || []).filter((eventType) => !supportedEvents.includes(eventType));
  if (invalid.length > 0) {
    throw new BadRequestError(`invalid webhook events: ${invalid.join(', ')}`);
  }
}

function buildTestPayload(webhook, user) {
  return {
    event_id: `test_${Date.now()}`,
    event_type: 'webhook.test',
    event_version: 1,
    occurred_at: new Date().toISOString(),
    aggregate: {
      type: 'webhook',
      id: webhook.id,
    },
    payload: {
      message: 'This is a test webhook from kk-life',
      webhook: { id: webhook.id, url: webhook.url },
      actor: { id: user?.id || null, name: user?.name || null },
    },
  };
}

app.get('/', requirePermission('webhooks:read'), async (c) => {
  const repo = new WebhookRepository(c.env.DB);
  const list = await repo.listAll();

  return c.json({
    success: true,
    data: list,
    supportedEvents: getSupportedEvents(),
  });
});

app.get('/:id', requirePermission('webhooks:read'), async (c) => {
  const repo = new WebhookRepository(c.env.DB);
  const webhook = await requireEntity(
    repo.getById(c.req.param('id')),
    () => new NotFoundError(MSG.WEBHOOK.NOT_FOUND)
  );
  return c.json({ success: true, data: webhook });
});

app.post('/', requirePermission('webhooks:write'), async (c) => {
  const repo = new WebhookRepository(c.env.DB);
  const body = await c.req.json();
  const user = c.get('user') || {};

  if (!body?.url) throw new BadRequestError(MSG.WEBHOOK.URL_REQUIRED);
  validateEvents(body.events || []);

  const created = await repo.create({
    url: body.url,
    events: body.events || [],
    secret: body.secret || null,
    headers: body.headers || {},
    enabled: body.enabled ?? true,
    actorId: user.id || user.name || null,
  });

  scheduleAuditEvent(c, {
    domain: 'webhooks',
    action: 'webhook.create',
    result: 'success',
    severity: 'critical',
    targetType: 'webhook',
    targetId: created.id,
    target_label: created.url,
    summary: `Created webhook ${created.url}`,
  });

  return c.json({ success: true, data: created }, 201);
});

app.put('/:id', requirePermission('webhooks:write'), async (c) => {
  const repo = new WebhookRepository(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  const user = c.get('user') || {};

  await requireEntity(repo.getById(id), () => new NotFoundError(MSG.WEBHOOK.NOT_FOUND));
  validateEvents(body.events || []);

  const updated = await repo.update(id, {
    url: body.url,
    events: body.events || [],
    secret: body.secret || null,
    headers: body.headers || {},
    enabled: body.enabled ?? true,
    actorId: user.id || user.name || null,
  });

  scheduleAuditEvent(c, {
    domain: 'webhooks',
    action: 'webhook.update',
    result: 'success',
    severity: 'critical',
    targetType: 'webhook',
    targetId: updated.id,
    target_label: updated.url,
    summary: `Updated webhook ${updated.url}`,
  });

  return c.json({ success: true, data: updated });
});

app.delete('/:id', requirePermission('webhooks:write'), async (c) => {
  const repo = new WebhookRepository(c.env.DB);
  const webhook = await requireEntity(
    repo.getById(c.req.param('id')),
    () => new NotFoundError(MSG.WEBHOOK.NOT_FOUND)
  );

  await repo.delete(webhook.id);

  scheduleAuditEvent(c, {
    domain: 'webhooks',
    action: 'webhook.delete',
    result: 'success',
    severity: 'critical',
    targetType: 'webhook',
    targetId: webhook.id,
    target_label: webhook.url,
    summary: `Deleted webhook ${webhook.url}`,
  });

  return c.json({
    success: true,
    message: MSG.WEBHOOK.DELETE_SUCCESS,
  });
});

app.post('/:id/test', requirePermission('webhooks:write'), async (c) => {
  const repo = new WebhookRepository(c.env.DB);
  const user = c.get('user') || {};
  const webhook = await requireEntity(
    repo.getById(c.req.param('id')),
    () => new NotFoundError(MSG.WEBHOOK.NOT_FOUND)
  );
  const payload = buildTestPayload(webhook, user);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'kk-life-Webhook/2.0',
    'X-Webhook-Event': payload.event_type,
    ...webhook.headers,
  };

  if (webhook.secret) {
    headers['X-Webhook-Signature'] = await generateHmacSignature(
      JSON.stringify(payload),
      webhook.secret
    );
  }

  const startTime = Date.now();
  const response = await fetch(webhook.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const duration = Date.now() - startTime;

  scheduleAuditEvent(c, {
    domain: 'webhooks',
    action: 'webhook.test',
    result: response.ok ? 'success' : 'failure',
    severity: 'high',
    targetType: 'webhook',
    targetId: webhook.id,
    target_label: webhook.url,
    summary: `Tested webhook ${webhook.url}`,
    metadata: {
      status: response.status,
      duration,
    },
  });

  return c.json(
    {
      success: response.ok,
      data: {
        status: response.status,
        duration,
      },
    },
    response.ok ? 200 : 502
  );
});

export default app;
