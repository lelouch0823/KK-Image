import { Hono } from 'hono';
import { WebhookRepository } from '../../../../repositories/WebhookRepository.js';
import { DOMAIN_EVENT_CATALOG } from '../../../../services/DomainEventCatalog.js';
import { generateHmacSignature, MSG } from '../../../../_shared/utils.js';
import { NotFoundError, BadRequestError } from '../../errors.js';
import { requirePermission } from '../../middleware/auth.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { requireEntity, parsePagination } from '../../_shared/route-helpers.js';

/**
 * 验证 Webhook URL 安全性（防止 SSRF）
 */
function validateWebhookUrl(urlStr) {
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    throw new BadRequestError('无效的 URL 格式');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestError('URL 必须使用 http 或 https 协议');
  }
  const hostname = url.hostname;
  const isPrivate = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|localhost|::1|\[::1\])/i.test(hostname);
  if (isPrivate) {
    throw new BadRequestError('不允许使用内网地址');
  }
}

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
  validateWebhookUrl(body.url);
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
  if (body.url) validateWebhookUrl(body.url);
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
    repo.getByIdWithSecret(c.req.param('id')),
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

/**
 * GET /logs - 获取投递日志列表
 */
app.get('/logs', requirePermission('webhooks:read'), async (c) => {
  const { env } = c;
  const { limit, offset } = parsePagination(c);
  const webhookId = c.req.query('webhook_id') || null;
  const success = c.req.query('success');
  const eventType = c.req.query('event') || null;

  let sql = `SELECT * FROM webhook_logs`;
  const conditions = [];
  const params = [];

  if (webhookId) {
    conditions.push('webhook_id = ?');
    params.push(webhookId);
  }
  if (success === '1' || success === 'true') {
    conditions.push('success = 1');
  } else if (success === '0' || success === 'false') {
    conditions.push('success = 0');
  }
  if (eventType) {
    conditions.push('event = ?');
    params.push(eventType);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  // 获取总数
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await env.DB.prepare(countSql).bind(...params).first();
  const total = countResult?.total || 0;

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(sql).bind(...params).all();

  return c.json({
    success: true,
    data: {
      items: results || [],
      total,
      limit,
      offset,
    },
  });
});

/**
 * POST /logs/:logId/retry - 重试失败的投递
 */
app.post('/logs/:logId/retry', requirePermission('webhooks:write'), async (c) => {
  const { env } = c;
  const logId = c.req.param('logId');

  // 查找原始投递日志
  const logEntry = await env.DB.prepare(
    'SELECT * FROM webhook_logs WHERE id = ?'
  ).bind(logId).first();

  if (!logEntry) {
    throw new NotFoundError('投递日志不存在');
  }

  // 查找对应的 webhook
  const webhookRepo = new WebhookRepository(env.DB);
  const webhook = await webhookRepo.getByIdWithSecret(logEntry.webhook_id);

  if (!webhook) {
    throw new NotFoundError(MSG.WEBHOOK.NOT_FOUND);
  }

  // 构建重试载荷
  const payload = logEntry.payload
    ? (typeof logEntry.payload === 'string' ? JSON.parse(logEntry.payload) : logEntry.payload)
    : {
        event_id: `retry_${Date.now()}`,
        event_type: logEntry.event || 'webhook.test',
        event_version: 1,
        occurred_at: new Date().toISOString(),
        aggregate: { type: 'retry', id: logId },
        payload: { message: 'Retry delivery', original_log_id: logId },
      };

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'kk-life-Webhook/2.0',
    'X-Webhook-Event': payload.event_type || logEntry.event || 'retry',
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

  // 记录重试日志
  await webhookRepo.logAttempt({
    webhookId: webhook.id,
    eventId: payload.event_id || null,
    eventType: payload.event_type || logEntry.event || 'retry',
    payload,
    statusCode: response.status,
    response: await response.text().catch(() => ''),
    durationMs: duration,
    deliveryKey: logEntry.delivery_key ? `${logEntry.delivery_key}:retry` : null,
    attemptNumber: (logEntry.attempt_number || 1) + 1,
    classification: response.ok ? 'delivered' : (response.status >= 400 && response.status < 500 ? 'terminal' : 'retryable'),
    success: response.ok,
  });

  scheduleAuditEvent(c, {
    domain: 'webhooks',
    action: 'webhook.retry',
    result: response.ok ? 'success' : 'failure',
    severity: 'high',
    targetType: 'webhook',
    targetId: webhook.id,
    target_label: webhook.url,
    summary: `Retried webhook delivery to ${webhook.url}`,
    metadata: { originalLogId: logId, status: response.status, duration },
  });

  return c.json({
    success: response.ok,
    data: {
      status: response.status,
      duration,
    },
  });
});

export default app;
