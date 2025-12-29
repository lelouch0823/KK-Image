/**
 * 管理端销售人员详情 API
 * GET /api/manage/salespersons/:id - 获取详情
 * PATCH /api/manage/salespersons/:id - 更新销售
 * DELETE /api/manage/salespersons/:id - 删除销售
 * POST /api/manage/salespersons/:id/reset-token - 重置链接
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { generateShareToken, hashPassword, now } from '../../utils/id.js';

/**
 * GET - 获取销售详情
 */
export async function onRequestGet(context) {
    const { env, params } = context;
    const { id } = params;

    try {
        const salesperson = await env.DB.prepare(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM orders WHERE salesperson_id = s.id) as order_count
            FROM salespersons s WHERE s.id = ?
        `).bind(id).first();

        if (!salesperson) {
            return error(MSG.SALESPERSON.NOT_FOUND, 404);
        }

        return success({
            id: salesperson.id,
            name: salesperson.name,
            store: salesperson.store,
            phone: salesperson.phone,
            accessToken: salesperson.access_token,
            isActive: !!salesperson.is_active,
            orderCount: salesperson.order_count,
            createdAt: salesperson.created_at,
            updatedAt: salesperson.updated_at
        });

    } catch (err) {
        console.error('Salesperson detail error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}

/**
 * PATCH - 更新销售
 */
export async function onRequestPatch(context) {
    const { env, params, request } = context;
    const { id } = params;

    try {
        const body = await request.json();
        const { name, store, phone, password, isActive } = body;

        // 检查销售存在
        const existing = await env.DB.prepare(`
            SELECT id FROM salespersons WHERE id = ?
        `).bind(id).first();

        if (!existing) {
            return error(MSG.SALESPERSON.NOT_FOUND, 404);
        }

        // 构建更新语句
        const updates = [];
        const values = [];

        if (name !== undefined) {
            if (!name.trim()) {
                return error(MSG.SALESPERSON.NAME_REQUIRED, 400);
            }
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (store !== undefined) {
            updates.push('store = ?');
            values.push(store || null);
        }

        if (phone !== undefined) {
            updates.push('phone = ?');
            values.push(phone || null);
        }

        if (password) {
            const passwordHash = await hashPassword(password, env.JWT_SECRET);
            updates.push('password_hash = ?');
            values.push(passwordHash);
        }

        if (isActive !== undefined) {
            updates.push('is_active = ?');
            values.push(isActive ? 1 : 0);
        }

        if (updates.length === 0) {
            return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
        }

        updates.push('updated_at = ?');
        values.push(now());
        values.push(id);

        await env.DB.prepare(`
            UPDATE salespersons SET ${updates.join(', ')} WHERE id = ?
        `).bind(...values).run();

        return success(null, MSG.SALESPERSON.UPDATE_SUCCESS);

    } catch (err) {
        console.error('Salesperson update error:', err);
        return error(`${MSG.COMMON.UPDATE_FAILED}: ${err.message}`, 500);
    }
}

/**
 * DELETE - 删除销售
 */
export async function onRequestDelete(context) {
    const { env, params } = context;
    const { id } = params;

    try {
        // 检查是否有关联订单
        const orderCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM orders WHERE salesperson_id = ?
        `).bind(id).first();

        if (orderCount.count > 0) {
            return error('该销售人员有关联订单，无法删除', 400);
        }

        const result = await env.DB.prepare(`
            DELETE FROM salespersons WHERE id = ?
        `).bind(id).run();

        if (result.meta.changes === 0) {
            return error(MSG.SALESPERSON.NOT_FOUND, 404);
        }

        return success(null, MSG.SALESPERSON.DELETE_SUCCESS);

    } catch (err) {
        console.error('Salesperson delete error:', err);
        return error(`${MSG.COMMON.DELETE_FAILED}: ${err.message}`, 500);
    }
}

/**
 * POST - 重置访问链接
 */
export async function onRequestPost(context) {
    const { env, params, request } = context;
    const { id } = params;
    const url = new URL(request.url);

    // 判断是重置链接操作
    if (url.pathname.endsWith('/reset-token')) {
        try {
            const newToken = generateShareToken(12);

            const result = await env.DB.prepare(`
                UPDATE salespersons SET access_token = ?, updated_at = ? WHERE id = ?
            `).bind(newToken, now(), id).run();

            if (result.meta.changes === 0) {
                return error(MSG.SALESPERSON.NOT_FOUND, 404);
            }

            return success({
                accessToken: newToken,
                accessUrl: `/order/${newToken}`
            }, MSG.SALESPERSON.TOKEN_RESET);

        } catch (err) {
            console.error('Salesperson reset token error:', err);
            return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
        }
    }

    return error(MSG.COMMON.INVALID_PARAMS, 400);
}
