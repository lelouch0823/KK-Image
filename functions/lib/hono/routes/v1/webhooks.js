import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';

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
 * GET /api/v1/webhooks - 获取 Webhook 列表
 */
app.get('/',
    requirePermission('webhooks:read'),
    async (c) => {
        const { env } = c;

        if (!env.WEBHOOKS_KV) {
            return c.json({
                success: true,
                data: [],
                supportedEvents: WEBHOOK_EVENTS
            });
        }

        const webhooks = await env.WEBHOOKS_KV.get('webhooks', 'json') || [];

        return c.json({
            success: true,
            data: webhooks,
            supportedEvents: WEBHOOK_EVENTS
        });
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

        if (!env.WEBHOOKS_KV) {
            return c.json({ success: false, error: 'Webhooks KV not configured' }, 503);
        }

        const webhooks = await env.WEBHOOKS_KV.get('webhooks', 'json') || [];
        const webhook = webhooks.find(w => w.id === id);

        if (!webhook) {
            return c.json({ success: false, error: 'Webhook 不存在' }, 404);
        }

        return c.json({ success: true, data: webhook });
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
            return c.json({ success: false, error: 'Webhook URL is required' }, 400);
        }

        if (!env.WEBHOOKS_KV) {
            return c.json({ success: false, error: 'Webhooks KV not configured' }, 503);
        }

        // 验证事件类型
        if (data.events?.length) {
            const invalid = data.events.filter(e => !WEBHOOK_EVENTS.includes(e));
            if (invalid.length) {
                return c.json({ success: false, error: `Invalid events: ${invalid.join(', ')}` }, 400);
            }
        }

        const webhook = {
            id: 'wh_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16),
            url: data.url,
            events: data.events || WEBHOOK_EVENTS,
            secret: data.secret || null,
            headers: data.headers || {},
            enabled: true,
            createdBy: user.name || user.id,
            createdAt: new Date().toISOString()
        };

        const webhooks = await env.WEBHOOKS_KV.get('webhooks', 'json') || [];
        webhooks.push(webhook);
        await env.WEBHOOKS_KV.put('webhooks', JSON.stringify(webhooks));

        return c.json({ success: true, data: webhook }, 201);
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

        if (!env.WEBHOOKS_KV) {
            return c.json({ success: false, error: 'Webhooks KV not configured' }, 503);
        }

        const webhooks = await env.WEBHOOKS_KV.get('webhooks', 'json') || [];
        const index = webhooks.findIndex(w => w.id === id);

        if (index === -1) {
            return c.json({ success: false, error: 'Webhook 不存在' }, 404);
        }

        webhooks[index] = {
            ...webhooks[index],
            ...data,
            id, // 保持 ID 不变
            updatedBy: user.name || user.id,
            updatedAt: new Date().toISOString()
        };

        await env.WEBHOOKS_KV.put('webhooks', JSON.stringify(webhooks));

        return c.json({ success: true, data: webhooks[index] });
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

        if (!env.WEBHOOKS_KV) {
            return c.json({ success: false, error: 'Webhooks KV not configured' }, 503);
        }

        const webhooks = await env.WEBHOOKS_KV.get('webhooks', 'json') || [];
        const filtered = webhooks.filter(w => w.id !== id);

        if (filtered.length === webhooks.length) {
            return c.json({ success: false, error: 'Webhook 不存在' }, 404);
        }

        await env.WEBHOOKS_KV.put('webhooks', JSON.stringify(filtered));

        return c.json({ success: true, message: 'Webhook 已删除' });
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

        if (!env.WEBHOOKS_KV) {
            return c.json({ success: false, error: 'Webhooks KV not configured' }, 503);
        }

        const webhooks = await env.WEBHOOKS_KV.get('webhooks', 'json') || [];
        const webhook = webhooks.find(w => w.id === id);

        if (!webhook) {
            return c.json({ success: false, error: 'Webhook 不存在' }, 404);
        }

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
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(webhook.secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(payload)));
            headers['X-Webhook-Signature'] = 'sha256=' + btoa(String.fromCharCode(...new Uint8Array(signature)));
        }

        try {
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000)
            });

            return c.json({
                success: true,
                data: {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (err) {
            return c.json({
                success: false,
                error: err.message,
                timestamp: new Date().toISOString()
            }, 500);
        }
    }
);

export default app;
