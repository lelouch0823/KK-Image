/**
 * 管理端客户列表 API
 * GET /api/manage/customers - 获取客户列表
 * POST /api/manage/customers - 创建新客户
 */

import { success, error, jsonResponse } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    try {
        let whereClause = '1 = 1';
        const bindParams = [];

        if (search) {
            whereClause += ' AND (name LIKE ? OR phone LIKE ? OR company LIKE ?)';
            const likeTerm = `%${search}%`;
            bindParams.push(likeTerm, likeTerm, likeTerm);
        }

        // 获取总数
        const { count: total } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM customers WHERE ${whereClause}
        `).bind(...bindParams).first();

        // 获取列表
        const { results } = await env.DB.prepare(`
            SELECT * FROM customers 
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).bind(...bindParams, limit, offset).all();

        // 解析 tags (存储为 JSON 字符串)
        const customers = results.map(c => ({
            ...c,
            tags: c.tags ? JSON.parse(c.tags) : []
        }));

        return success({
            list: customers,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });

    } catch (err) {
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}

export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        const body = await request.json();
        const { name, phone = '', company = '', email = '', address = '', tags = [], remark = '' } = body;

        if (!name) {
            return error(MSG.COMMON.INVALID_PARAMS + ': name', 400);
        }

        const id = crypto.randomUUID();
        const now = Date.now();
        // 假设通过中间件 context.data.user 获取当前用户，暂未实现中间件注入 user id 到 context
        const createdBy = 'admin'; // TODO: Get from auth context

        await env.DB.prepare(`
            INSERT INTO customers (id, name, phone, company, email, address, tags, remark, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id, name, phone, company, email, address,
            JSON.stringify(tags), remark, createdBy, now, now
        ).run();

        return success({ id, name }, MSG.COMMON.CREATE_SUCCESS);

    } catch (err) {
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
