/**
 * 销售端订单已读 API
 * PATCH /api/order/:token/orders/:id/read
 */

import { success, error } from '../../../../utils/response.js';
import { MSG } from '../../../../utils/messages.js';
import { verifyJWT } from '../../../../utils/auth.js';
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
