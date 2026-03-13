import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { CustomerRepository } from '../../../../repositories/CustomerRepository.js';
import { MSG } from '../../_shared/utils.js';
import { withCache } from '../../middleware/cache.js';
import { NotFoundError, BadRequestError } from '../../errors.js';
import { parsePagination, createListCacheInvalidator, scheduleCacheInvalidation, requireEntity } from '../../_shared/route-helpers.js';
import { requirePermission } from '../../middleware/auth.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'customers', action: 'customer.create', severity: 'normal', targetType: 'customer' },
    { method: 'PUT', path: '/:id', domain: 'customers', action: 'customer.update', severity: 'normal', targetType: 'customer' },
    { method: 'DELETE', path: '/:id', domain: 'customers', action: 'customer.delete', severity: 'high', targetType: 'customer' },
]);
app.use('*', requirePermission('orders:manage'));

const getCacheUrls = createListCacheInvalidator('/api/manage/customers', {
    allowedKeys: ['page', 'limit', 'search'],
    defaults: { page: 1, limit: 20 },
    maxLimit: 100,
});

function scheduleCustomerCacheInvalidation(c) {
    scheduleCacheInvalidation(c, getCacheUrls(c));
}

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
 * GET / - 分页查询客户列表
 */
app.get('/', withCache(60), async (c) => {
    const { env } = c;
    const { page, limit } = parsePagination(c);
    const search = c.req.query('search') || '';

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
});

/**
 * POST / - 创建新客户
 */
app.post('/', zValidator('json', CreateCustomerSchema), async (c) => {
    const { env } = c;
    const user = c.get('user');
    const body = c.req.valid('json');

    const repo = new CustomerRepository(env.DB);
    const customer = await repo.create({
        ...body,
        createdBy: user.name,
    });

    scheduleCustomerCacheInvalidation(c);
    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.create',
        result: 'success',
        severity: 'normal',
        targetType: 'customer',
        targetId: customer.id,
        target_label: customer.name,
        summary: `${user.name} created customer ${customer.name}`,
        metadata: body,
    });

    return c.json({
        success: true,
        message: MSG.COMMON.CREATE_SUCCESS,
        data: { id: customer.id, name: customer.name },
    });
});

/**
 * GET /:id - 获取客户详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    const repo = new CustomerRepository(env.DB);
    const customer = await requireEntity(
        repo.findById(id),
        () => new NotFoundError(MSG.COMMON.NOT_FOUND)
    );

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
});

/**
 * PUT /:id - 更新客户信息
 */
app.put('/:id', zValidator('json', UpdateCustomerSchema), async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const repo = new CustomerRepository(env.DB);
    const success = await repo.update(id, body);

    if (!success) {
        throw new NotFoundError(MSG.COMMON.NOT_FOUND);
    }

    scheduleCustomerCacheInvalidation(c);
    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.update',
        result: 'success',
        severity: 'normal',
        targetType: 'customer',
        targetId: id,
        target_label: id,
        summary: `Customer ${id} updated`,
        metadata: body,
    });

    return c.json({
        success: true,
        message: MSG.COMMON.UPDATE_SUCCESS,
        data: { id },
    });
});

/**
 * DELETE /:id - 删除客户
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new CustomerRepository(env.DB);

    // 检查是否有关联订单
    const hasOrders = await repo.hasOrders(id);
    if (hasOrders) {
        throw new BadRequestError(MSG.CUSTOMER.HAS_ORDERS);
    }

    const deleted = await repo.delete(id);
    if (!deleted) {
        throw new NotFoundError(MSG.CUSTOMER.NOT_FOUND);
    }

    scheduleCustomerCacheInvalidation(c);
    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.delete',
        result: 'success',
        severity: 'high',
        targetType: 'customer',
        targetId: id,
        target_label: id,
        summary: `Customer ${id} deleted`,
    });

    return c.json({ success: true, message: MSG.CUSTOMER.DELETE_SUCCESS });
});

/**
 * GET /:id/orders - 获取客户关联的订单
 */
app.get('/:id/orders', async (c) => {
    const { env } = c;
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
});

export default app;
