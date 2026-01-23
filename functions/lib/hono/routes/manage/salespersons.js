import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { SalespersonRepository } from '../../../../repositories/SalespersonRepository.js';
import { MSG } from '../../_shared/utils.js';

const app = new Hono();

// 验证 Schema
const CreateSalespersonSchema = z.object({
    name: z.string().min(1, MSG.SALESPERSON.NAME_REQUIRED),
    store: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    password: z.string().min(1, MSG.SALESPERSON.PASSWORD_REQUIRED),
});

const UpdateSalespersonSchema = z.object({
    name: z.string().optional(),
    store: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    password: z.string().optional(),
    isActive: z.boolean().optional(),
});

/**
 * GET / - 获取销售列表
 */
app.get('/', async (c) => {
    const { env } = c;
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const search = c.req.query('search') || '';

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const { results, total, pages } = await repo.list({ page, limit, search });

    return c.json({
        success: true,
        data: {
            salespersons: results.map((s) => ({
                id: s.id,
                name: s.name,
                store: s.store,
                phone: s.phone,
                accessToken: s.access_token,
                isActive: !!s.is_active,
                orderCount: s.order_count,
                createdAt: s.created_at,
                updatedAt: s.updated_at,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: pages,
            },
        },
    });
});

/**
 * POST / - 创建销售人员
 */
app.post('/', zValidator('json', CreateSalespersonSchema), async (c) => {
    const { env } = c;
    const body = c.req.valid('json');

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const salesperson = await repo.create({
        name: body.name.trim(),
        store: body.store || null,
        phone: body.phone || null,
        password: body.password,
    });

    return c.json({
        success: true,
        message: MSG.SALESPERSON.CREATE_SUCCESS,
        data: salesperson
    }, 201);
});

/**
 * GET /:id - 获取销售详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const salesperson = await repo.findById(id);

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
            createdAt: salesperson.created_at,
            updatedAt: salesperson.updated_at
        }
    });
});

/**
 * PUT /:id - 更新销售信息
 */
app.put('/:id', zValidator('json', UpdateSalespersonSchema), async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);

    // 更新基本信息
    const success = await repo.update(id, {
        name: body.name,
        store: body.store,
        phone: body.phone,
        password: body.password,
        isActive: body.isActive
    });

    if (!success) {
        return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
    }

    return c.json({
        success: true,
        message: MSG.SALESPERSON.UPDATE_SUCCESS,
        data: { id },
    });
});

/**
 * DELETE /:id - 删除销售人员
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);

    // 检查是否有关联订单
    const hasOrders = await repo.hasOrders(id);
    if (hasOrders) {
        return c.json({ success: false, error: MSG.SALESPERSON.HAS_ORDERS }, 400);
    }

    const deleted = await repo.delete(id);
    if (!deleted) {
        return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
    }

    return c.json({ success: true, message: MSG.SALESPERSON.DELETE_SUCCESS });
});

/**
 * POST /:id/reset-token - 重置访问令牌
 */
app.post('/:id/reset-token', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const newToken = await repo.resetAccessToken(id);

    if (!newToken) {
        return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
    }

    return c.json({
        success: true,
        message: MSG.SALESPERSON.TOKEN_RESET,
        data: { accessToken: newToken }
    });
});

export default app;
