/**
 * 销售端通知 API
 * GET /api/sales/:token/notifications - 获取销售员专属通知列表
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateSalesperson } from '../../utils/salesperson-auth.js';
import { NotificationRepository } from '../../../repositories/NotificationRepository.js';

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const accessToken = params.token;

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);

        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const unreadOnly = url.searchParams.get('unread_only') === 'true';

        const notificationRepo = new NotificationRepository(env.DB);
        const result = await notificationRepo.listForSalesperson(salesperson.id, { unreadOnly, limit });

        return success(result);
    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        if (err.message === MSG.SALESPERSON.DISABLED) {
            return error(err.message, 403);
        }
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
