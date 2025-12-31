/**
 * 销售端订单已读 API
 * PATCH /api/order/:token/orders/:id/read
 */

import { success, error } from '../../../../utils/response.js';
import { MSG } from '../../../../utils/messages.js';
import { authenticateSalesperson } from '../../../../utils/salesperson-auth.js';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';

/**
 * PATCH - 清除红点
 */
export async function onRequestPatch(context) {
    const { env, params, request } = context;
    const { token: accessToken, id: orderId } = params;

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);
        const orderRepo = new OrderRepository(env.DB);

        // 使用 Repository 清除红点
        await orderRepo.clearNewFeedback(orderId, salesperson.id);

        return success(null, MSG.ORDER.ALREADY_READ);

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        console.error('Order read error:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
