/**
 * 销售端订单评论 API
 * POST /api/order/:token/orders/:id/comment
 */

import { success, error } from '../../../../utils/response.js';
import { MSG } from '../../../../utils/messages.js';
import { generateId, now } from '../../../../utils/id.js';
import { authenticateSalesperson } from '../../../../utils/salesperson-auth.js';

/**
 * POST - 添加留言
 */
export async function onRequestPost(context) {
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

        // 使用 batch() 合并数据库写操作，确保原子性
        await env.DB.batch([
            env.DB.prepare(`
                INSERT INTO order_timeline (id, order_id, action_type, actor_type, actor_id, actor_name, comment, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                generateId(),
                orderId,
                'comment',
                'salesperson',
                salesperson.id,
                salesperson.name,
                comment.trim(),
                now()
            ),
            env.DB.prepare(`
                UPDATE orders SET updated_at = ? WHERE id = ?
            `).bind(now(), orderId)
        ]);

        return success(null, MSG.ORDER.COMMENT_ADDED);

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        console.error('Order comment error:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
