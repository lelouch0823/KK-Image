import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { generatePrefixedId, generateHmacSignature, MSG } from '../../_shared/utils.js';

const app = new Hono();

const WEBHOOK_EVENTS = [
    'file.uploaded',
    'file.deleted',
    'file.updated',
    'folder.created',
    'folder.deleted',
    'user.login',
    'webhook.test'
];

/**
 * 将数据库行转换为 Webhook 对象
 */
function rowToWebhook(row) {
    return {
        id: row.id,
        url: row.url,
        events: row.events ? JSON.parse(row.events) : WEBHOOK_EVENTS,
        secret: row.secret,
        headers: row.headers ? JSON.parse(row.headers) : {},
        enabled: Boolean(row.enabled),
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at
    };
}

/**
 * GET /api/v1/webhooks - 获取 Webhook 列表
 */
app.get('/',
    requirePermission('webhooks:read'),
    async (c) => {
        const { env } = c;

        try {
            const { results } = await env.DB.prepare(
                'SELECT * FROM webhooks ORDER BY created_at DESC'
            ).all();

            return c.json({
                success: true,
                data: results.map(rowToWebhook),
                supportedEvents: WEBHOOK_EVENTS
            });
        } catch (err) {
            console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * GET /api/v1/webhooks/:id - 获取单个 Webhook
 */
app.get('/:id',
    requirePermission('webhooks:read'),
    async (c) => {
        const id = c.req.param('id');
        const { env } = c;

        try {
            const webhook = await env.DB.prepare(
                'SELECT * FROM webhooks WHERE id = ?'
            ).bind(id).first();

            if (!webhook) {
                return c.json({ success: false, error: MSG.WEBHOOK.NOT_FOUND }, 404);
            }

            return c.json({ success: true, data: rowToWebhook(webhook) });
        } catch (err) {
            console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * POST /api/v1/webhooks - 创建 Webhook
 */
app.post('/',
    requirePermission('webhooks:write'),
    async (c) => {
        const data = await c.req.json();
        const user = c.get('user');
        const { env } = c;

        if (!data.url) {
            return c.json({ success: false, error: MSG.WEBHOOK.URL_REQUIRED }, 400);
        }

        // 验证事件类型
        if (data.events?.length) {
            const invalid = data.events.filter(e => !WEBHOOK_EVENTS.includes(e));
            if (invalid.length) {
                return c.json({ success: false, error: `${MSG.WEBHOOK.INVALID_EVENTS}: ${invalid.join(', ')}` }, 400);
            }
        }

        try {
            const id = generatePrefixedId('wh_');
            const nowMs = Date.now();

            await env.DB.prepare(`
                INSERT INTO webhooks (id, url, events, secret, headers, enabled, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                id,
                data.url,
                JSON.stringify(data.events || WEBHOOK_EVENTS),
                data.secret || null,
                JSON.stringify(data.headers || {}),
                1,
                user.name || user.id,
                nowMs
            ).run();

            const webhook = {
                id,
                url: data.url,
                events: data.events || WEBHOOK_EVENTS,
                secret: data.secret || null,
                headers: data.headers || {},
                enabled: true,
                createdBy: user.name || user.id,
                createdAt: nowMs
            };

            return c.json({ success: true, data: webhook }, 201);
        } catch (err) {
            console.error(`${MSG.COMMON.CREATE_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.CREATE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * PUT /api/v1/webhooks/:id - 更新 Webhook
 */
app.put('/:id',
    requirePermission('webhooks:write'),
    async (c) => {
        const id = c.req.param('id');
        const data = await c.req.json();
        const user = c.get('user');
        const { env } = c;

        try {
            const existing = await env.DB.prepare(
                'SELECT id FROM webhooks WHERE id = ?'
            ).bind(id).first();

            if (!existing) {
                return c.json({ success: false, error: MSG.WEBHOOK.NOT_FOUND }, 404);
            }

            const updates = [];
            const values = [];

            if (data.url !== undefined) {
                updates.push('url = ?');
                values.push(data.url);
            }
            if (data.events !== undefined) {
                updates.push('events = ?');
                values.push(JSON.stringify(data.events));
            }
            if (data.secret !== undefined) {
                updates.push('secret = ?');
                values.push(data.secret);
            }
            if (data.headers !== undefined) {
                updates.push('headers = ?');
                values.push(JSON.stringify(data.headers));
            }
            if (data.enabled !== undefined) {
                updates.push('enabled = ?');
                values.push(data.enabled ? 1 : 0);
            }

            updates.push('updated_by = ?');
            values.push(user.name || user.id);
            updates.push('updated_at = ?');
            values.push(Date.now());
            values.push(id);

            await env.DB.prepare(
                `UPDATE webhooks SET ${updates.join(', ')} WHERE id = ?`
            ).bind(...values).run();

            const updated = await env.DB.prepare(
                'SELECT * FROM webhooks WHERE id = ?'
            ).bind(id).first();

            return c.json({ success: true, data: rowToWebhook(updated) });
        } catch (err) {
            console.error(`${MSG.COMMON.UPDATE_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.UPDATE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * DELETE /api/v1/webhooks/:id - 删除 Webhook
 */
app.delete('/:id',
    requirePermission('webhooks:write'),
    async (c) => {
        const id = c.req.param('id');
        const { env } = c;

        try {
            const existing = await env.DB.prepare(
                'SELECT id FROM webhooks WHERE id = ?'
            ).bind(id).first();

            if (!existing) {
                return c.json({ success: false, error: MSG.WEBHOOK.NOT_FOUND }, 404);
            }

            await env.DB.prepare('DELETE FROM webhooks WHERE id = ?').bind(id).run();

            return c.json({ success: true, message: MSG.WEBHOOK.DELETE_SUCCESS });
        } catch (err) {
            console.error(`${MSG.COMMON.DELETE_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.DELETE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * POST /api/v1/webhooks/:id/test - 测试 Webhook
 */
app.post('/:id/test',
    requirePermission('webhooks:write'),
    async (c) => {
        const id = c.req.param('id');
        const user = c.get('user');
        const { env } = c;

        try {
            const row = await env.DB.prepare(
                'SELECT * FROM webhooks WHERE id = ?'
            ).bind(id).first();

            if (!row) {
                return c.json({ success: false, error: MSG.WEBHOOK.NOT_FOUND }, 404);
            }

            const webhook = rowToWebhook(row);

            // 构建测试载荷
            const payload = {
                event: 'webhook.test',
                timestamp: new Date().toISOString(),
                data: {
                    message: 'This is a test webhook from KK-Image',
                    webhook: { id: webhook.id, url: webhook.url },
                    user: { id: user.id, name: user.name }
                },
                id: 'test_' + Date.now()
            };

            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'KK-Image-Webhook/2.0',
                'X-Webhook-Event': payload.event,
                'X-Webhook-ID': payload.id,
                ...webhook.headers
            };

            // 添加签名
            if (webhook.secret) {
                headers['X-Webhook-Signature'] = await generateHmacSignature(JSON.stringify(payload), webhook.secret);
            }

            const startTime = Date.now();
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000)
            });
            const duration = Date.now() - startTime;

            // 记录日志到 D1
            const logId = generatePrefixedId('log_');
            await env.DB.prepare(`
                INSERT INTO webhook_logs (id, webhook_id, event, payload, status_code, duration_ms, success, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                logId,
                webhook.id,
                payload.event,
                JSON.stringify(payload),
                response.status,
                duration,
                response.ok ? 1 : 0,
                Date.now()
            ).run();

            return c.json({
                success: true,
                data: {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    durationMs: duration,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (err) {
            console.error(`${MSG.COMMON.OP_FAILED}:`, err);
            return c.json({
                success: false,
                error: `${MSG.WEBHOOK.TEST_FAILED}: ${err.message}`,
                timestamp: new Date().toISOString()
            }, 500);
        }
    }
);

export default app;
