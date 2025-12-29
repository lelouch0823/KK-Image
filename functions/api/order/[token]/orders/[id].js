/**
 * 销售端订单详情 API
 * GET /api/order/:token/orders/:id - 获取订单详情
 * POST /api/order/:token/orders/:id/comment - 添加留言
 * PATCH /api/order/:token/orders/:id/read - 清除红点
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { generateId, now } from '../../../utils/id.js';
import { verifyJWT } from '../../../utils/auth.js';
import { parse as parseCookie } from 'cookie';

/**
 * 验证销售端 JWT 并返回销售信息
 */
async function authenticateSalesperson(request, env, accessToken) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookie(cookieHeader);
    const jwt = cookies.order_token;

    if (!jwt) {
        throw new Error(MSG.AUTH.REQUIRED);
    }

    const payload = await verifyJWT(jwt, env);
    if (payload.type !== 'salesperson') {
        throw new Error(MSG.AUTH.FORBIDDEN);
    }

    const salesperson = await env.DB.prepare(`
        SELECT id, name, store, is_active
        FROM salespersons WHERE id = ? AND access_token = ?
    `).bind(payload.id, accessToken).first();

    if (!salesperson) {
        throw new Error(MSG.SALESPERSON.NOT_FOUND);
    }

    if (!salesperson.is_active) {
        throw new Error(MSG.SALESPERSON.DISABLED);
    }

    return salesperson;
}

/**
 * 记录时间轴
 */
async function logTimeline(db, params) {
    const {
        orderId,
        actionType,
        actorType,
        actorId,
        actorName,
        fieldName = null,
        oldValue = null,
        newValue = null,
        reason = null,
        comment = null
    } = params;

    await db.prepare(`
        INSERT INTO order_timeline (id, order_id, action_type, actor_type, actor_id, actor_name, field_name, old_value, new_value, reason, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        generateId(),
        orderId,
        actionType,
        actorType,
        actorId,
        actorName,
        fieldName,
        oldValue,
        newValue,
        reason,
        comment,
        now()
    ).run();
}

/**
 * GET - 获取订单详情
 */
export async function onRequestGet(context) {
    const { env, params, request } = context;
    const { token: accessToken, id: orderId } = params;

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);

        // 获取订单
        const order = await env.DB.prepare(`
            SELECT o.*, f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE o.id = ? AND o.salesperson_id = ?
        `).bind(orderId, salesperson.id).first();

        if (!order) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        // 获取订单图片
        const { results: files } = await env.DB.prepare(`
            SELECT of.section, of.sort_order, f.id, f.original_name, f.storage_key, f.mime_type, f.size
            FROM order_files of
            JOIN files f ON of.file_id = f.id
            WHERE of.order_id = ?
            ORDER BY of.section, of.sort_order
        `).bind(orderId).all();

        // 获取时间轴
        const { results: timeline } = await env.DB.prepare(`
            SELECT id, action_type, actor_type, actor_name, field_name, old_value, new_value, reason, comment, created_at
            FROM order_timeline
            WHERE order_id = ?
            ORDER BY created_at DESC
        `).bind(orderId).all();

        // 解析数据
        const originalData = order.original_data ? JSON.parse(order.original_data) : {};
        const currentData = order.current_data ? JSON.parse(order.current_data) : {};

        // 格式化文件
        const formattedFiles = files.map(f => ({
            id: f.id,
            name: f.original_name,
            url: `/file/${f.storage_key}`,
            mimeType: f.mime_type,
            size: f.size,
            section: f.section
        }));

        return success({
            id: order.id,
            orderNo: order.order_no,
            status: order.status,
            hasNewFeedback: !!order.has_new_feedback,
            originalData,
            currentData,
            mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
            mainImageId: order.main_image_id,
            files: formattedFiles,
            timeline: timeline.map(t => ({
                id: t.id,
                actionType: t.action_type,
                actorType: t.actor_type,
                actorName: t.actor_name,
                fieldName: t.field_name,
                oldValue: t.old_value,
                newValue: t.new_value,
                reason: t.reason,
                comment: t.comment,
                createdAt: t.created_at
            })),
            createdAt: order.created_at,
            updatedAt: order.updated_at
        });

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        console.error('Order detail error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}

/**
 * POST - 添加留言
 */
export async function onRequestPost(context) {
    const { env, params, request } = context;
    const { token: accessToken, id: orderId } = params;
    const url = new URL(request.url);

    // 判断是留言还是已读
    if (url.pathname.endsWith('/comment')) {
        return handleComment(context);
    }

    return error(MSG.COMMON.INVALID_PARAMS, 400);
}

async function handleComment(context) {
    const { env, params, request } = context;
    const { token: accessToken, id: orderId } = params;

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);
        const body = await request.json();
        const { comment } = body;

        if (!comment || !comment.trim()) {
            return error(MSG.COMMON.INVALID_PARAMS + ': 留言内容不能为空', 400);
        }

        // 验证订单归属
        const order = await env.DB.prepare(`
            SELECT id FROM orders WHERE id = ? AND salesperson_id = ?
        `).bind(orderId, salesperson.id).first();

        if (!order) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        // 记录时间轴
        await logTimeline(env.DB, {
            orderId,
            actionType: 'comment',
            actorType: 'salesperson',
            actorId: salesperson.id,
            actorName: salesperson.name,
            comment: comment.trim()
        });

        // 更新订单时间
        await env.DB.prepare(`
            UPDATE orders SET updated_at = ? WHERE id = ?
        `).bind(now(), orderId).run();

        return success(null, MSG.ORDER.COMMENT_ADDED);

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        console.error('Order comment error:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}

/**
 * PATCH - 清除红点
 */
export async function onRequestPatch(context) {
    const { env, params, request } = context;
    const { token: accessToken, id: orderId } = params;

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);

        // 验证订单归属并清除红点
        const result = await env.DB.prepare(`
            UPDATE orders SET has_new_feedback = 0 WHERE id = ? AND salesperson_id = ?
        `).bind(orderId, salesperson.id).run();

        if (result.meta.changes === 0) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        return success(null, MSG.ORDER.ALREADY_READ);

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        console.error('Order read error:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
