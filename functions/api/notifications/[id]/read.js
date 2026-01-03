/**
 * 管理端标记通知已读 API
 * POST /api/notifications/[id]/read - 标记单个已读
 * POST /api/notifications/all/read - 标记全部已读
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { NotificationRepository } from '../../../repositories/NotificationRepository.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const { id } = params;

  if (!id) {
    return error(MSG.COMMON.INVALID_PARAMS, 400);
  }

  try {
    const notificationRepo = new NotificationRepository(env.DB);

    if (id === 'all') {
      await notificationRepo.markAllAsReadForAdmin();
    } else {
      await notificationRepo.markAsRead(id);
    }

    return success(null, MSG.COMMON.UPDATE_SUCCESS);
  } catch (err) {
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}

