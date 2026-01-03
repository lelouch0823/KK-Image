/**
 * 销售端标记通知已读 API
 * POST /api/sales/:token/notifications/:id/read - 标记单个已读
 * POST /api/sales/:token/notifications/all/read - 标记全部已读
 */

import { success, error } from '../../../../utils/response.js';
import { MSG } from '../../../../utils/messages.js';
import { authenticateSalesperson } from '../../../../utils/salesperson-auth.js';
import { NotificationRepository } from '../../../../../repositories/NotificationRepository.js';

export async function onRequestPost(context) {
    const { env, params, request } = context;
    const { token: accessToken, id } = params;

    if (!id) {
        return error(MSG.COMMON.INVALID_PARAMS, 400);
    }

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);
        const notificationRepo = new NotificationRepository(env.DB);

        if (id === 'all') {
            await notificationRepo.markAllAsReadForSalesperson(salesperson.id);
        } else {
            // 验证通知属于该销售员（安全校验）
            const { results } = await env.DB
                .prepare(`SELECT id FROM notifications WHERE id = ? AND receiver = 'sales' AND salesperson_id = ?`)
                .bind(id, salesperson.id)
                .all();

            if (results.length > 0) {
                await notificationRepo.markAsRead(id);
            }
        }

        return success(null, MSG.COMMON.UPDATE_SUCCESS);
    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
