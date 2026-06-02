import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { CustomerRepository } from '../../../../repositories/CustomerRepository.ts';
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

const BatchTagsSchema = z.object({
    ids: z.array(z.string()).min(1).max(500),
    tag: z.string().min(1).max(100),
}).strict();

const BatchExportSchema = z.object({
    ids: z.array(z.string()).min(1).max(10000),
}).strict();

/**
 * GET / - 分页查询客户列表（含 RFM 分段）
 */
app.get('/', async (c) => {
    const { env } = c;
    const { page, limit } = parsePagination(c);
    const search = c.req.query('search') || '';

    const repo = new CustomerRepository(env.DB);
    const { results, total, pages } = await repo.list({ page, limit, search });

    // 批量获取 RFM 分段
    const ids = results.map((c) => c.id);
    const segmentMap = await repo.getBatchRfmSegments(ids);

    // 转换 snake_case 为 camelCase 以兼容前端
    const list = results.map((c) => {
        const rfm = segmentMap.get(c.id) || { segment: 'new', orderCount: 0 };
        return {
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
            segment: rfm.segment,
            orderCount: rfm.orderCount,
        };
    });

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
app.post('/batch/tags', zValidator('json', BatchTagsSchema), async (c) => {
    const { env } = c;
    const { ids, tag } = c.req.valid('json');

    const repo = new CustomerRepository(env.DB);
    const normalizedTag = tag.trim();
    let successCount = 0;

    // 批量查询所有目标客户，避免 N+1
    const customers = await repo.findByIds(ids);

    // 使用事务批量更新
    const statements = [];
    for (const customer of customers) {
        const existingTags = Array.isArray(customer.tags) ? customer.tags : [];
        if (existingTags.includes(normalizedTag)) continue;

        const newTags = [...existingTags, normalizedTag];
        statements.push(
            env.DB.prepare('UPDATE customers SET tags = ?, updated_at = ? WHERE id = ?')
                .bind(JSON.stringify(newTags), Date.now(), customer.id)
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
app.post('/batch/export', zValidator('json', BatchExportSchema), async (c) => {
    const { env } = c;
    const { ids } = c.req.valid('json');

    const repo = new CustomerRepository(env.DB);
    const customers = await repo.findByIds(ids);

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
 * GET /export - 导出客户数据（CSV / XLSX）
 */
app.get('/export', async (c) => {
    const { env } = c;
    const format = String(c.req.query('format') || 'csv').trim().toLowerCase();
    const search = c.req.query('search') || '';

    try {
        const repo = new CustomerRepository(env.DB);
        const PAGE_LIMIT = 500;
        let page = 1;
        let allCustomers = [];

        // 分页加载全部客户
        while (true) {
            const { results } = await repo.list({ page, limit: PAGE_LIMIT, search });
            allCustomers.push(...results);
            if (results.length < PAGE_LIMIT) break;
            page += 1;
            if (page > 200) break; // 安全上限 100000 条
        }

        // 批量获取 RFM 分段
        const ids = allCustomers.map((c) => c.id);
        const segmentMap = await repo.getBatchRfmSegments(ids);

        // 组装导出行
        const columns = [
            { key: 'name', label: '客户名称' },
            { key: 'phone', label: '电话' },
            { key: 'company', label: '公司' },
            { key: 'email', label: '邮箱' },
            { key: 'address', label: '地址' },
            { key: 'tags', label: '标签' },
            { key: 'segment', label: '客户分段' },
            { key: 'order_count', label: '订单数' },
            { key: 'last_order_date', label: '最近下单' },
            { key: 'remark', label: '备注' },
        ];

        const segmentLabels = { vip: 'VIP', active: '活跃', 'at-risk': '流失风险', lost: '已流失', new: '新客户' };
        const formatDate = (ts) => {
            if (!ts) return '';
            return new Date(Number(ts) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
        };

        const rows = allCustomers.map((cust) => {
            const rfm = segmentMap.get(cust.id) || { segment: 'new', orderCount: 0, lastOrderAt: null };
            return {
                name: cust.name || '',
                phone: cust.phone || '',
                company: cust.company || '',
                email: cust.email || '',
                address: cust.address || '',
                tags: Array.isArray(cust.tags) ? cust.tags.join('; ') : '',
                segment: segmentLabels[rfm.segment] || rfm.segment,
                order_count: rfm.orderCount || 0,
                last_order_date: formatDate(rfm.lastOrderAt),
                remark: cust.remark || '',
            };
        });

        const date = new Date().toISOString().slice(0, 10);
        const filename = `customers_${date}`;

        if (format === 'xlsx') {
            const XLSX = await import('xlsx');
            const header = columns.map((col) => col.label);
            const dataRows = rows.map((row) => columns.map((col) => row[col.key]));
            const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
            ws['!cols'] = columns.map((col) => ({ wch: Math.max(col.label.length * 2, 12) }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '客户数据');
            const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

            return new Response(buffer, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
                    'Cache-Control': 'no-cache',
                },
            });
        }

        // CSV 格式（默认）
        const escapeCSV = (v) => {
            const s = v === null || v === undefined ? '' : String(v);
            return `"${s.replace(/"/g, '""')}"`;
        };
        const header = columns.map((col) => col.label).join(',');
        const csvRows = rows.map((row) => columns.map((col) => escapeCSV(row[col.key])).join(','));
        const csv = '﻿' + [header, ...csvRows].join('\n');

        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}.csv"`,
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Customer export failed:', error);
        return c.json({ success: false, error: error?.message || '导出失败' }, 500);
    }
});

/**
 * POST /import/confirm - 确认导入客户（批量插入）
 */
const ImportConfirmSchema = z.object({
    rows: z.array(z.object({
        name: z.string().min(1),
        phone: z.string().optional().default(''),
        company: z.string().optional().default(''),
        email: z.string().optional().default(''),
        address: z.string().optional().default(''),
        tags: z.array(z.string()).optional().default([]),
        remark: z.string().optional().default(''),
    })).min(1, '请提供至少一条客户数据'),
});

app.post('/import/confirm', zValidator('json', ImportConfirmSchema), async (c) => {
    const { env } = c;
    const user = c.get('user');
    const { rows } = c.req.valid('json');

    const repo = new CustomerRepository(env.DB);
    const now = Date.now();
    let imported = 0;
    let skipped = 0;
    const statements = [];

    for (const row of rows) {
        // 重复检测：按 phone 或 name+company
        let existing = null;
        if (row.phone) {
            const { results } = await env.DB.prepare(
                'SELECT id FROM customers WHERE phone = ? AND phone != "" LIMIT 1'
            ).bind(row.phone).all();
            if (results.length > 0) existing = results[0];
        }
        if (!existing && row.name && row.company) {
            const { results } = await env.DB.prepare(
                'SELECT id FROM customers WHERE name = ? AND company = ? AND company != "" LIMIT 1'
            ).bind(row.name, row.company).all();
            if (results.length > 0) existing = results[0];
        }

        if (existing) {
            skipped += 1;
            continue;
        }

        const id = crypto.randomUUID();
        const tags = JSON.stringify(row.tags || []);
        statements.push(
            env.DB.prepare(
                `INSERT INTO customers (id, name, phone, company, email, address, tags, remark, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(id, row.name, row.phone || '', row.company || '', row.email || '',
                row.address || '', tags, row.remark || '', user.name || 'admin', now, now)
        );
        imported += 1;
    }

    if (statements.length > 0) {
        // 分批执行，每批最多 50 条
        const BATCH_SIZE = 50;
        for (let i = 0; i < statements.length; i += BATCH_SIZE) {
            const batch = statements.slice(i, i + BATCH_SIZE);
            await env.DB.batch(batch);
        }
    }

    scheduleCacheInvalidation(c, getManageCustomerCacheUrls(c));
    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.import',
        result: 'success',
        severity: 'normal',
        targetType: 'customer',
        summary: `Imported ${imported} customers, skipped ${skipped} duplicates`,
        metadata: { imported, skipped, total: rows.length },
    });

    return c.json({
        success: true,
        message: `成功导入 ${imported} 个客户` + (skipped > 0 ? `，跳过 ${skipped} 个重复客户` : ''),
        data: { imported, skipped, total: rows.length },
    });
});

/**
 * GET /tags - 获取所有标签（去重 + 使用统计）
 * 注意：必须在 /:id 之前注册，避免 Hono 将 "tags" 匹配为 ID
 */
app.get('/tags', async (c) => {
    const { env } = c;
    const repo = new CustomerRepository(env.DB);
    const tags = await repo.getAllTags();

    return c.json({ success: true, data: tags });
});

/**
 * GET /suggest - 客户名称/手机搜索建议（轻量级）
 */
app.get('/suggest', async (c) => {
    const { env } = c;
    const q = c.req.query('q') || '';
    const limit = Math.min(Number(c.req.query('limit')) || 10, 20);

    if (!q.trim()) {
        return c.json({ success: true, data: [] });
    }

    const repo = new CustomerRepository(env.DB);
    const data = await repo.suggest(q, limit);

    return c.json({ success: true, data });
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

/**
 * GET /:id/stats - 获取客户订单统计 + RFM 分段
 */
app.get('/:id/stats', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    const repo = new CustomerRepository(env.DB);
    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError(MSG.COMMON.NOT_FOUND);

    const [rfm, favoriteProducts] = await Promise.all([
        repo.getRfmSegment(id),
        repo.getFavoriteProducts(id),
    ]);

    return c.json({
        success: true,
        data: {
            ...rfm,
            favoriteProducts,
        },
    });
});

// ========================================
// 沟通记录 (Communications)
// ========================================

const COMMUNICATION_TYPES = ['note', 'call', 'email', 'meeting', 'wechat'];

const CreateCommunicationSchema = z.object({
    type: z.enum(COMMUNICATION_TYPES).default('note'),
    content: z.string().min(1, '沟通内容不能为空'),
});

/**
 * GET /:id/communications - 获取客户沟通记录
 */
app.get('/:id/communications', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const { page, limit } = parsePagination(c, { limit: 20 });

    const repo = new CustomerRepository(env.DB);
    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError(MSG.COMMON.NOT_FOUND);

    const { results, total } = await repo.getCommunications(id, { page, limit });

    return c.json({
        success: true,
        data: results,
        pagination: { total },
    });
});

/**
 * POST /:id/communications - 添加沟通记录
 */
app.post('/:id/communications', zValidator('json', CreateCommunicationSchema), async (c) => {
    const { env } = c;
    const user = c.get('user');
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const repo = new CustomerRepository(env.DB);
    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError(MSG.COMMON.NOT_FOUND);

    const comm = await repo.addCommunication(id, body.type, body.content, user.name);

    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.add_communication',
        result: 'success',
        severity: 'normal',
        targetType: 'customer',
        targetId: id,
        summary: `Added ${body.type} communication to customer ${id}`,
        metadata: { type: body.type, content: body.content },
    });

    return c.json({
        success: true,
        message: '沟通记录添加成功',
        data: comm,
    });
});

/**
 * DELETE /:id/communications/:commId - 删除沟通记录
 */
app.delete('/:id/communications/:commId', async (c) => {
    const { env } = c;
    const commId = c.req.param('commId');

    const repo = new CustomerRepository(env.DB);
    const deleted = await repo.deleteCommunication(commId);

    if (!deleted) throw new NotFoundError('沟通记录不存在');

    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.delete_communication',
        result: 'success',
        severity: 'normal',
        targetType: 'customer',
        targetId: c.req.param('id'),
        summary: `Deleted communication ${commId}`,
    });

    return c.json({ success: true, message: '沟通记录已删除' });
});

/**
 * GET /:id/tags - 获取客户标签列表
 */
app.get('/:id/tags', async (c) => {
    const { env } = c;
    const id = c.req.param('id');

    const repo = new CustomerRepository(env.DB);
    const tags = await repo.getTags(id);

    return c.json({ success: true, data: tags });
});

/**
 * POST /:id/tags - 添加客户标签
 */
app.post('/:id/tags', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const body = await c.req.json();
    const { tag } = body;

    if (!tag || typeof tag !== 'string' || !tag.trim()) {
        throw new BadRequestError('请输入标签名称');
    }

    const repo = new CustomerRepository(env.DB);
    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError(MSG.COMMON.NOT_FOUND);

    const result = await repo.addTag(id, tag.trim());

    scheduleCacheInvalidation(c, getManageCustomerCacheUrls(c));
    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.add_tag',
        result: 'success',
        severity: 'normal',
        targetType: 'customer',
        targetId: id,
        summary: `Added tag "${tag.trim()}" to customer ${id}`,
    });

    return c.json({
        success: true,
        message: '标签添加成功',
        data: result,
    });
});

/**
 * DELETE /:id/tags/:tagName - 删除客户标签
 */
app.delete('/:id/tags/:tagName', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const tagName = decodeURIComponent(c.req.param('tagName'));

    const repo = new CustomerRepository(env.DB);
    const deleted = await repo.removeTag(id, tagName);

    if (!deleted) throw new NotFoundError('标签不存在');

    scheduleCacheInvalidation(c, getManageCustomerCacheUrls(c));
    scheduleAuditEvent(c, {
        domain: 'customers',
        action: 'customer.remove_tag',
        result: 'success',
        severity: 'normal',
        targetType: 'customer',
        targetId: id,
        summary: `Removed tag "${tagName}" from customer ${id}`,
    });

    return c.json({ success: true, message: '标签已删除' });
});

export default app;
