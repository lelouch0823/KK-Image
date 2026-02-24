import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { CustomerRepository } from '../../../../repositories/CustomerRepository.js';
import { MSG } from '../../_shared/utils.js';

const app = new Hono();

// 验证 Schema
const CreateCustomerSchema = z.object({
    name: z.string().min(1, MSG.COMMON.REQUIRED),
    phone: z.string().optional().default(''),
    company: z.string().optional().default(''),
    email: z.string().email().optional().or(z.literal('')).default(''),
    address: z.string().optional().default(''),
    tags: z.array(z.string()).optional().default([]),
    remark: z.string().optional().default(''),
});

const UpdateCustomerSchema = CreateCustomerSchema.partial();

/**
 * GET / - 获取客户列表
 */
app.get('/', async (c) => {
    const { env } = c;
    try {
        const search = c.req.query('search') || '';
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');

        const repo = new CustomerRepository(env.DB);
        const { results, total, pages } = await repo.list({ page, limit, search });

        // 转换 snake_case 为 camelCase 以兼容前端
        const list = results.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            company: c.company,
            email: c.email,
            address: c.address,
            tags: c.tags,
            remark: c.remark,
            createdBy: c.created_by,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
        }));

        return c.json({
            success: true,
            data: {
                list,
                total,
                page,
                limit,
                totalPages: pages,
            },
        });
    } catch (err) {
        console.error('[Customers] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * POST / - 创建新客户
 */
app.post('/', zValidator('json', CreateCustomerSchema), async (c) => {
    const { env } = c;
    try {
        const user = c.get('user');
        const body = c.req.valid('json');

        const repo = new CustomerRepository(env.DB);
        const customer = await repo.create({
            ...body,
            createdBy: user.name,
        });

        return c.json({
            success: true,
            message: MSG.COMMON.CREATE_SUCCESS,
            data: { id: customer.id, name: customer.name },
        });
    } catch (err) {
        console.error('[Customers] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * GET /:id - 获取客户详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    try {
        const id = c.req.param('id');

        const repo = new CustomerRepository(env.DB);
        const customer = await repo.findById(id);

        if (!customer) {
            return c.json({ success: false, error: MSG.COMMON.NOT_FOUND }, 404);
        }

        // 转换为 camelCase 以兼容前端
        return c.json({
            success: true,
            data: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                company: customer.company,
                email: customer.email,
                address: customer.address,
                tags: customer.tags,
                remark: customer.remark,
                createdBy: customer.created_by,
                createdAt: customer.created_at,
                updatedAt: customer.updated_at,
            }
        });
    } catch (err) {
        console.error('[Customers] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * PUT /:id - 更新客户信息
 */
app.put('/:id', zValidator('json', UpdateCustomerSchema), async (c) => {
    const { env } = c;
    try {
        const id = c.req.param('id');
        const body = c.req.valid('json');

        const repo = new CustomerRepository(env.DB);
        const success = await repo.update(id, body);

        if (!success) {
            return c.json({ success: false, error: MSG.COMMON.NOT_FOUND }, 404);
        }

        return c.json({
            success: true,
            message: MSG.COMMON.UPDATE_SUCCESS,
            data: { id },
        });
    } catch (err) {
        console.error('[Customers] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * DELETE /:id - 删除客户
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    try {
        const id = c.req.param('id');

        const repo = new CustomerRepository(env.DB);

        // 检查是否有关联订单
        const hasOrders = await repo.hasOrders(id);
        if (hasOrders) {
            return c.json({ success: false, error: MSG.CUSTOMER.CANNOT_DELETE_HAS_ORDERS }, 400);
        }

        const deleted = await repo.delete(id);
        if (!deleted) {
            return c.json({ success: false, error: MSG.COMMON.NOT_FOUND }, 404);
        }

        return c.json({ success: true, message: MSG.COMMON.DELETE_SUCCESS });
    } catch (err) {
        console.error('[Customers] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * GET /:id/orders - 获取客户关联的订单
 */
app.get('/:id/orders', async (c) => {
    const { env } = c;
    try {
        const id = c.req.param('id');
        const limit = parseInt(c.req.query('limit') || '50');

        const { OrderRepository } = await import('../../../../repositories/OrderRepository.js');
        const repo = new OrderRepository(env.DB);

        const { items } = await repo.listForAdmin({
            customerId: id,
            limit: limit,
            page: 1,
        });

        return c.json({ success: true, data: items });
    } catch (err) {
        console.error('[Customers] 操作失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default app;
