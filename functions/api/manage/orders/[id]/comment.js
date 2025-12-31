/**
 * 管理端添加留言 API
 * POST /api/manage/orders/:id/comment
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { now } from '../../../utils/id.js';
import { verifyJWT, ADMIN_AUTH_COOKIE } from '../../../utils/auth.js';
import { parse as parseCookie } from 'cookie';
import { OrderTimelineRepository } from '../../../../repositories/OrderTimelineRepository.js';

/**
 * 获取当前管理员信息
 */
async function getAdmin(request, env) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookie(cookieHeader);
    const jwt = cookies[ADMIN_AUTH_COOKIE];

    if (!jwt) {
        throw new Error(MSG.AUTH.REQUIRED);
    }

    const payload = await verifyJWT(jwt, env);
    return {
        id: payload.sub,
        name: payload.name || 'Admin',
        type: 'admin'
    };
}

/**
 * POST - 添加留言
 */
export async function onRequestPost(context) {
    const { env, params, request } = context;
    const { id: orderId } = params;

    try {
        const admin = await getAdmin(request, env);
        const body = await request.json();
        const { comment } = body;

        if (!comment || !comment.trim()) {
            // SOTA: 虽然前端做校验，后端也必须校验
            return error(MSG.COMMON.INVALID_PARAMS, 400);
        }

        // 获取当前订单 (确保订单存在)
        const order = await env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first();
        if (!order) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        // 记录时间轴
        const timelineRepo = new OrderTimelineRepository(env.DB);
        await timelineRepo.addTimelineEntry(orderId, {
            actionType: 'comment',
            actorType: 'admin',
            actorId: admin.id,
            actorName: admin.name,
            comment: comment.trim()
        });

        // 标记为有新反馈，更新时间
        await env.DB.prepare('UPDATE orders SET has_new_feedback = 1, updated_at = ? WHERE id = ?')
            .bind(now(), orderId).run();

        return success(null, MSG.ORDER.COMMENT_ADDED);

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED) {
            return error(err.message, 401);
        }
        console.error('Order comment error:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
