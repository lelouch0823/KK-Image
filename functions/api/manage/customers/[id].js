/**
 * 管理端客户详情 API
 * GET /api/manage/customers/[id] - 获取客户详情
 * PUT /api/manage/customers/[id] - 更新客户信息
 * DELETE /api/manage/customers/[id] - 删除客户
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';

export async function onRequestGet(context) {
    const { env, params } = context;
    const { id } = params;

    try {
        const customer = await env.DB.prepare(`
            SELECT * FROM customers WHERE id = ?
        `).bind(id).first();

        if (!customer) {
            return error(MSG.COMMON.NOT_FOUND, 404);
        }

        // 解析 tags
        customer.tags = customer.tags ? JSON.parse(customer.tags) : [];

        return success(customer);
    } catch (err) {
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}

export async function onRequestPut(context) {
    const { env, params, request } = context;
    const { id } = params;

    try {
        const existing = await env.DB.prepare(`SELECT id FROM customers WHERE id = ?`).bind(id).first();
        if (!existing) {
            return error(MSG.COMMON.NOT_FOUND, 404);
        }

        const body = await request.json();
        const { name, phone, company, email, address, tags, remark } = body;
        const now = Date.now();

        // 动态构建更新语句
        const updates = [];
        const bindings = [];

        if (name !== undefined) { updates.push('name = ?'); bindings.push(name); }
        if (phone !== undefined) { updates.push('phone = ?'); bindings.push(phone); }
        if (company !== undefined) { updates.push('company = ?'); bindings.push(company); }
        if (email !== undefined) { updates.push('email = ?'); bindings.push(email); }
        if (address !== undefined) { updates.push('address = ?'); bindings.push(address); }
        if (tags !== undefined) { updates.push('tags = ?'); bindings.push(JSON.stringify(tags)); }
        if (remark !== undefined) { updates.push('remark = ?'); bindings.push(remark); }

        updates.push('updated_at = ?');
        bindings.push(now);
        bindings.push(id); // WHERE clause binding

        await env.DB.prepare(`
            UPDATE customers SET ${updates.join(', ')} WHERE id = ?
        `).bind(...bindings).run();

        return success({ id }, MSG.COMMON.UPDATE_SUCCESS);

    } catch (err) {
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const { id } = params;

    try {
        // 检查是否有关联订单
        const { count } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM orders WHERE customer_id = ?
        `).bind(id).first();

        if (count > 0) {
            return error(MSG.CUSTOMER.CANNOT_DELETE_HAS_ORDERS, 400);
        }

        await env.DB.prepare(`
            DELETE FROM customers WHERE id = ?
        `).bind(id).run();

        return success(null, MSG.COMMON.DELETE_SUCCESS);

    } catch (err) {
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
