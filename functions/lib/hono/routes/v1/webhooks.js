import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { parseJsonArray, parseJsonObject } from '../../../../api/utils/json.js';
import { generatePrefixedId, generateHmacSignature, MSG } from '../../../../_shared/utils.js';
import { NotFoundError, BadRequestError } from '../../errors.js';
import { appendOptionalUpdate, requireEntity } from '../../_shared/route-helpers.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/', domain: 'v1-webhooks', action: 'v1.webhook.create', severity: 'critical', targetType: 'webhook', runtimeAssertionLevel: 'runtime', highRisk: true },
  { method: 'PUT', path: '/:id', domain: 'v1-webhooks', action: 'v1.webhook.update', severity: 'critical', targetType: 'webhook', highRisk: true },
  { method: 'DELETE', path: '/:id', domain: 'v1-webhooks', action: 'v1.webhook.delete', severity: 'critical', targetType: 'webhook', highRisk: true },
  { method: 'POST', path: '/:id/test', domain: 'v1-webhooks', action: 'v1.webhook.test', severity: 'high', targetType: 'webhook', runtimeAssertionLevel: 'runtime' },
]);

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
  // 禁止内网地址（SSRF 防护）
  const hostname = url.hostname;
  const isPrivate = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|localhost|::1|\[::1\])/i.test(hostname);
  if (isPrivate) {
    throw new BadRequestError('不允许使用内网地址');
  }
}

const WEBHOOK_EVENTS = [
  'file.uploaded',
  'file.deleted',
  'file.updated',
  'folder.created',
  'folder.deleted',
  'user.login',
  'webhook.test',
];

/**
 * 将数据库行转换为 Webhook 对象
 */
function rowToWebhook(row) {
  return {
    id: row.id,
    url: row.url,
    events: parseJsonArray(row.events, WEBHOOK_EVENTS),
    hasSecret: Boolean(row.secret),
    headers: parseJsonObject(row.headers, {}),
    enabled: Boolean(row.enabled),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/v1/webhooks - 获取 Webhook 列表
 */
app.get('/', requirePermission('webhooks:read'), async (c) => {
  const { env } = c;

  const { results } = await env.DB.prepare(
    'SELECT * FROM webhooks ORDER BY created_at DESC'
  ).all();

  return c.json({
    success: true,
    data: results.map(rowToWebhook),
    supportedEvents: WEBHOOK_EVENTS,
  });
});

/**
 * GET /api/v1/webhooks/:id - 获取单个 Webhook
 */
app.get('/:id', requirePermission('webhooks:read'), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  const webhook = await requireEntity(
    env.DB.prepare('SELECT * FROM webhooks WHERE id = ?').bind(id).first(),
    () => new NotFoundError(MSG.WEBHOOK.NOT_FOUND)
  );

  return c.json({ success: true, data: rowToWebhook(webhook) });
});

/**
 * POST /api/v1/webhooks - 创建 Webhook
 */
app.post('/', requirePermission('webhooks:write'), async (c) => {
  const data = await c.req.json();
  const user = c.get('user');
  const { env } = c;

  if (!data.url) throw new BadRequestError(MSG.WEBHOOK.URL_REQUIRED);
  validateWebhookUrl(data.url);

  // 验证事件类型
  if (data.events?.length) {
    const invalid = data.events.filter((e) => !WEBHOOK_EVENTS.includes(e));
    if (invalid.length) {
      throw new BadRequestError(`${MSG.WEBHOOK.INVALID_EVENTS}: ${invalid.join(', ')}`);
    }
  }

  const id = generatePrefixedId('wh_');
  const nowMs = Date.now();

  await env.DB.prepare(
    `INSERT INTO webhooks (id, url, events, secret, headers, enabled, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      data.url,
      JSON.stringify(data.events || WEBHOOK_EVENTS),
      data.secret || null,
      JSON.stringify(data.headers || {}),
      1,
      user.name || user.id,
      nowMs
    )
    .run();

  const webhook = {
    id,
    url: data.url,
    events: data.events || WEBHOOK_EVENTS,
    hasSecret: Boolean(data.secret),
    headers: data.headers || {},
    enabled: true,
    createdBy: user.name || user.id,
    createdAt: nowMs,
  };
  scheduleAuditEvent(c, {
    domain: 'v1-webhooks',
    action: 'v1.webhook.create',
    result: 'success',
    severity: 'critical',
    targetType: 'webhook',
    targetId: id,
    target_label: data.url,
    summary: `Created webhook ${data.url}`,
  });

  return c.json({ success: true, data: webhook }, 201);
});

/**
 * PUT /api/v1/webhooks/:id - 更新 Webhook
 */
app.put('/:id', requirePermission('webhooks:write'), async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const user = c.get('user');
  const { env } = c;

  await requireEntity(
    env.DB.prepare('SELECT id FROM webhooks WHERE id = ?').bind(id).first(),
    () => new NotFoundError(MSG.WEBHOOK.NOT_FOUND)
  );

  const updates = [];
  const values = [];

  if (data.url) validateWebhookUrl(data.url);
  appendOptionalUpdate(updates, values, 'url = ?', data.url);
  appendOptionalUpdate(updates, values, 'events = ?', data.events, (value) => JSON.stringify(value));
  appendOptionalUpdate(updates, values, 'secret = ?', data.secret);
  appendOptionalUpdate(updates, values, 'headers = ?', data.headers, (value) => JSON.stringify(value));
  appendOptionalUpdate(updates, values, 'enabled = ?', data.enabled, (value) => (value ? 1 : 0));

  updates.push('updated_by = ?');
  values.push(user.name || user.id);
  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  await env.DB.prepare(`UPDATE webhooks SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await env.DB.prepare('SELECT * FROM webhooks WHERE id = ?').bind(id).first();
  scheduleAuditEvent(c, {
    domain: 'v1-webhooks',
    action: 'v1.webhook.update',
    result: 'success',
    severity: 'critical',
    targetType: 'webhook',
    targetId: id,
    target_label: updated?.url || id,
    summary: `Updated webhook ${updated?.url || id}`,
  });

  return c.json({ success: true, data: rowToWebhook(updated) });
});

/**
 * DELETE /api/v1/webhooks/:id - 删除 Webhook
 */
app.delete('/:id', requirePermission('webhooks:write'), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  await requireEntity(
    env.DB.prepare('SELECT id FROM webhooks WHERE id = ?').bind(id).first(),
    () => new NotFoundError(MSG.WEBHOOK.NOT_FOUND)
  );

  await env.DB.prepare('DELETE FROM webhooks WHERE id = ?').bind(id).run();
  scheduleAuditEvent(c, {
    domain: 'v1-webhooks',
    action: 'v1.webhook.delete',
    result: 'success',
    severity: 'critical',
    targetType: 'webhook',
    targetId: id,
    target_label: id,
    summary: `Deleted webhook ${id}`,
  });

  return c.json({ success: true, message: MSG.WEBHOOK.DELETE_SUCCESS });
});

/**
 * POST /api/v1/webhooks/:id/test - 测试 Webhook
 */
app.post('/:id/test', requirePermission('webhooks:write'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const { env } = c;

  const row = await requireEntity(
    env.DB.prepare('SELECT * FROM webhooks WHERE id = ?').bind(id).first(),
    () => new NotFoundError(MSG.WEBHOOK.NOT_FOUND)
  );

  const webhook = rowToWebhook(row);

  // 构建测试载荷
  const payload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from kk-life',
      webhook: { id: webhook.id, url: webhook.url },
      user: { id: user.id, name: user.name },
    },
    id: 'test_' + Date.now(),
  };

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'kk-life-Webhook/2.0',
    'X-Webhook-Event': payload.event,
    'X-Webhook-ID': payload.id,
    ...webhook.headers,
  };

  // 添加签名
  if (row.secret) {
    headers['X-Webhook-Signature'] = await generateHmacSignature(
      JSON.stringify(payload),
      row.secret
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

  // 记录日志到 D1
  const logId = generatePrefixedId('log_');
  await env.DB.prepare(
    `INSERT INTO webhook_logs (id, webhook_id, event, payload, status_code, duration_ms, success, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      logId,
      webhook.id,
      payload.event,
      JSON.stringify(payload),
      response.status,
      duration,
      response.ok ? 1 : 0,
      Date.now()
    )
    .run();
  scheduleAuditEvent(c, {
    domain: 'v1-webhooks',
    action: 'v1.webhook.test',
    result: 'success',
    severity: 'high',
    targetType: 'webhook',
    targetId: id,
    target_label: webhook.url,
    summary: `Tested webhook ${webhook.url}`,
    metadata: { status: response.status, ok: response.ok },
  });

  return c.json({
    success: true,
    data: {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    },
  });
});

export default app;
