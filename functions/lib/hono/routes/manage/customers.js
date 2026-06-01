import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { CustomerRepository } from '../../../../repositories/CustomerRepository.js';
import { MSG } from '../../../../_shared/utils.js';
import { withCache } from '../../middleware/cache.js';
import { NotFoundError, BadRequestError } from '../../errors.js';
import { parsePagination, requireEntity, scheduleCacheInvalidation } from '../../_shared/route-helpers.js';
import { requirePermission } from '../../middleware/auth.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';
import { getManageCustomerCacheUrls } from '../_shared/cache-urls.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'customers', action: 'customer.create', severity: 'normal', targetType: 'customer' },
    { method: 'PUT', path: '/:id', domain: 'customers', action: 'customer.update', severity: 'normal', targetType: 'customer' },
    { method: 'DELETE', path: '/:id', domain: 'customers', action: 'customer.delete', severity: 'high', targetType: 'customer' },
]);
app.use('*', requirePermission('orders:manage'));

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
app.get('/', async (c) => {
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
        data: list,
        pagination: {
            page,
            limit,
            total,
            totalPages: pages,
        },
    });
});

/**
 * POST /batch/tags - 批量添加标签
 */
app.post('/batch/tags', async (c) => {
    const { env } = c;
    const body = await c.req.json();
    const { ids, tag } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestError('请选择至少一个客户');
    }
    if (!tag || typeof tag !== 'string' || !tag.trim()) {
        throw new BadRequestError('请输入标签');
    }

    const repo = new CustomerRepository(env.DB);
    const normalizedTag = tag.trim();
    let successCount = 0;

    // 使用事务批量更新
    const statements = [];
    for (const id of ids) {
        const customer = await repo.findById(id);
        if (!customer) continue;

        const existingTags = Array.isArray(customer.tags) ? customer.tags : [];
        if (existingTags.includes(normalizedTag)) continue;

        const newTags = [...existingTags, normalizedTag];
        statements.push(
            env.DB.prepare('UPDATE customers SET tags = ?, updated_at = ? WHERE id = ?')
                .bind(JSON.stringify(newTags), Date.now(), id)
        );
    }

    if (statements.length > 0) {
        await env.DB.batch(statements);
        successCount = statements.length;
    }

    scheduleCacheInvalidation(c, getManageCustomerCacheUrls(c));
    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.batch_add_tag',
        result: 'success',
        severity: 'normal',
        targetType: 'customer',
        summary: `Batch added tag "${normalizedTag}" to ${successCount} customers`,
        metadata: { count: successCount, tag: normalizedTag },
    });

    return c.json({
        success: true,
        message: `成功为 ${successCount} 个客户添加标签`,
        data: { count: successCount },
    });
});

/**
 * POST /batch/export - 批量导出选中客户
 */
app.post('/batch/export', async (c) => {
    const { env } = c;
    const body = await c.req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestError('请选择至少一个客户');
    }

    const repo = new CustomerRepository(env.DB);
    const customers = [];
    for (const id of ids) {
        const customer = await repo.findById(id);
        if (customer) customers.push(customer);
    }

    // CSV 列定义
    const columns = [
        { key: 'name', label: '客户名称' },
        { key: 'phone', label: '电话' },
        { key: 'company', label: '公司' },
        { key: 'email', label: '邮箱' },
        { key: 'address', label: '地址' },
        { key: 'tags', label: '标签' },
        { key: 'remark', label: '备注' },
        { key: 'created_at', label: '创建时间' },
    ];

    const escapeCSV = (v) => {
        const normalized = v === null || v === undefined ? '' : String(v);
        return `"${normalized.replace(/"/g, '""')}"`;
    };

    const getChinaDateStr = (ts) => {
        if (!ts) return '';
        return new Date(Number(ts) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    };

    const header = columns.map(col => col.label).join(',');
    const rows = customers.map(customer => {
        return [
            escapeCSV(customer.name),
            escapeCSV(customer.phone),
            escapeCSV(customer.company),
            escapeCSV(customer.email),
            escapeCSV(customer.address),
            escapeCSV(Array.isArray(customer.tags) ? customer.tags.join('; ') : ''),
            escapeCSV(customer.remark),
            escapeCSV(getChinaDateStr(customer.created_at)),
        ].join(',');
    });

    const csv = '﻿' + [header, ...rows].join('\n');
    const filename = `customers_${getChinaDateStr(Date.now())}.csv`;

    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.batch_export',
        result: 'success',
        severity: 'normal',
        targetType: 'customer',
        summary: `Batch exported ${customers.length} customers`,
        metadata: { count: customers.length },
    });

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
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

    await publishSingleDomainEventAndPoll(c, {
        event_type: 'customer_created',
        aggregate_type: 'customer',
        aggregate_id: customer.id,
        payload: {
            customer_id: customer.id,
        },
    }, `customer-create:${customer.id}`);
    // 异步失效缓存
    scheduleCacheInvalidation(c, getManageCustomerCacheUrls(c));
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
app.get('/:id', withCache(30), async (c) => {
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

    await publishSingleDomainEventAndPoll(c, {
        event_type: 'customer_updated',
        aggregate_type: 'customer',
        aggregate_id: id,
        payload: {
            customer_id: id,
        },
    }, `customer-update:${id}`);
    // 异步失效缓存
    scheduleCacheInvalidation(c, getManageCustomerCacheUrls(c));
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

    await publishSingleDomainEventAndPoll(c, {
        event_type: 'customer_deleted',
        aggregate_type: 'customer',
        aggregate_id: id,
        payload: {
            customer_id: id,
        },
    }, `customer-delete:${id}`);
    // 异步失效缓存
    scheduleCacheInvalidation(c, getManageCustomerCacheUrls(c));
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
    const { limit } = parsePagination(c, { limit: 50 });

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
