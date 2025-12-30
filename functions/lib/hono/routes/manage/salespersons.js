import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, generateShareToken, hashPassword, now, MSG } from '../../_shared/utils.js';

const app = new Hono();

// Schemas
const CreateSalespersonSchema = z.object({
    name: z.string().min(1).max(100),
    store: z.string().max(200).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    password: z.string().min(4).max(50)
});

const UpdateSalespersonSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    store: z.string().max(200).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    password: z.string().min(4).max(50).optional(),
    isActive: z.boolean().optional()
});

/**
 * GET /api/manage/salespersons - 获取销售人员列表
 */
app.get('/', async (c) => {
    const { env } = c;

    try {
        const { results } = await env.DB.prepare(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM orders WHERE salesperson_id = s.id) as order_count
            FROM salespersons s
            ORDER BY s.created_at DESC
        `).all();

        return c.json({
            success: true,
            data: results.map(s => ({
                id: s.id,
                name: s.name,
                store: s.store,
                phone: s.phone,
                accessToken: s.access_token,
                isActive: !!s.is_active,
                orderCount: s.order_count,
                createdAt: s.created_at,
                updatedAt: s.updated_at
            }))
        });
    } catch (err) {
        console.error('Salesperson list error:', err);
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

/**
 * GET /api/manage/salespersons/:id - 获取销售人员详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    try {
        const salesperson = await env.DB.prepare(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM orders WHERE salesperson_id = s.id) as order_count
            FROM salespersons s WHERE s.id = ?
        `).bind(id).first();

        if (!salesperson) {
            return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
        }

        return c.json({
            success: true,
            data: {
                id: salesperson.id,
                name: salesperson.name,
                store: salesperson.store,
                phone: salesperson.phone,
                accessToken: salesperson.access_token,
                isActive: !!salesperson.is_active,
                orderCount: salesperson.order_count,
                createdAt: salesperson.created_at,
                updatedAt: salesperson.updated_at
            }
        });
    } catch (err) {
        console.error('Salesperson detail error:', err);
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

/**
 * POST /api/manage/salespersons - 创建销售人员
 */
app.post('/',
    requirePermission('salespersons:write'),
    zValidator('json', CreateSalespersonSchema),
    async (c) => {
        const { env } = c;
        const { name, store, phone, password } = c.req.valid('json');

        try {
            const id = generateId();
            const accessToken = generateShareToken(12);
            const passwordHash = await hashPassword(password, env.JWT_SECRET);
            const timestamp = now();

            await env.DB.prepare(`
                INSERT INTO salespersons (id, name, store, phone, access_token, password_hash, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            `).bind(id, name.trim(), store || null, phone || null, accessToken, passwordHash, timestamp, timestamp).run();

            return c.json({
                success: true,
                data: {
                    id,
                    name: name.trim(),
                    store,
                    phone,
                    accessToken,
                    accessUrl: `/order/${accessToken}`,
                    isActive: true,
                    createdAt: timestamp
                }
            }, 201);
        } catch (err) {
            console.error('Salesperson create error:', err);
            return c.json({ success: false, error: `${MSG.COMMON.CREATE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * PATCH /api/manage/salespersons/:id - 更新销售人员
 */
app.patch('/:id',
    requirePermission('salespersons:write'),
    zValidator('json', UpdateSalespersonSchema),
    async (c) => {
        const { env } = c;
        const id = c.req.param('id');
        const data = c.req.valid('json');

        try {
            const existing = await env.DB.prepare('SELECT id FROM salespersons WHERE id = ?').bind(id).first();
            if (!existing) {
                return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
            }

            const updates = [];
            const values = [];

            if (data.name !== undefined) {
                updates.push('name = ?');
                values.push(data.name.trim());
            }
            if (data.store !== undefined) {
                updates.push('store = ?');
                values.push(data.store || null);
            }
            if (data.phone !== undefined) {
                updates.push('phone = ?');
                values.push(data.phone || null);
            }
            if (data.password) {
                const passwordHash = await hashPassword(data.password, env.JWT_SECRET);
                updates.push('password_hash = ?');
                values.push(passwordHash);
            }
            if (data.isActive !== undefined) {
                updates.push('is_active = ?');
                values.push(data.isActive ? 1 : 0);
            }

            if (updates.length === 0) {
                return c.json({ success: false, error: MSG.COMMON.NO_UPDATE_FIELDS }, 400);
            }

            updates.push('updated_at = ?');
            values.push(now());
            values.push(id);

            await env.DB.prepare(`UPDATE salespersons SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

            return c.json({ success: true, message: MSG.SALESPERSON.UPDATE_SUCCESS });
        } catch (err) {
            console.error('Salesperson update error:', err);
            return c.json({ success: false, error: `${MSG.COMMON.UPDATE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * DELETE /api/manage/salespersons/:id - 删除销售人员
 */
app.delete('/:id',
    requirePermission('salespersons:delete'),
    async (c) => {
        const { env } = c;
        const id = c.req.param('id');

        try {
            const orderCount = await env.DB.prepare('SELECT COUNT(*) as count FROM orders WHERE salesperson_id = ?').bind(id).first();
            if (orderCount.count > 0) {
                return c.json({ success: false, error: '该销售人员有关联订单，无法删除' }, 400);
            }

            const result = await env.DB.prepare('DELETE FROM salespersons WHERE id = ?').bind(id).run();
            if (result.meta.changes === 0) {
                return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
            }

            return c.json({ success: true, message: MSG.SALESPERSON.DELETE_SUCCESS });
        } catch (err) {
            console.error('Salesperson delete error:', err);
            return c.json({ success: false, error: `${MSG.COMMON.DELETE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * POST /api/manage/salespersons/:id/reset-token - 重置访问链接
 */
app.post('/:id/reset-token',
    requirePermission('salespersons:write'),
    async (c) => {
        const { env } = c;
        const id = c.req.param('id');

        try {
            const newToken = generateShareToken(12);
            const result = await env.DB.prepare('UPDATE salespersons SET access_token = ?, updated_at = ? WHERE id = ?')
                .bind(newToken, now(), id).run();

            if (result.meta.changes === 0) {
                return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
            }

            return c.json({
                success: true,
                data: {
                    accessToken: newToken,
                    accessUrl: `/order/${newToken}`
                },
                message: MSG.SALESPERSON.TOKEN_RESET
            });
        } catch (err) {
            console.error('Salesperson reset token error:', err);
            return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
        }
    }
);

export default app;
