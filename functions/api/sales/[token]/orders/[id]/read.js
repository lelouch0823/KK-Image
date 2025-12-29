/**
 * 销售端订单已读 API
 * PATCH /api/order/:token/orders/:id/read
 */

import { success, error } from '../../../../utils/response.js';
import { MSG } from '../../../../utils/messages.js';
import { authenticateSalesperson } from '../../../../utils/salesperson-auth.js';

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
