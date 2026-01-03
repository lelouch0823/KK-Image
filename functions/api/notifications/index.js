/**
 * 管理端通知 API
 * GET /api/notifications - 获取通知列表 (未读优先，按时间倒序)
 * POST /api/notifications - 创建通知 (供后台调用)
 */

import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';
import { authenticateAdmin } from '../utils/auth.js';
import { NotificationRepository } from '../../repositories/NotificationRepository.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const unreadOnly = url.searchParams.get('unread_only') === 'true';

  try {
    await authenticateAdmin(request, env);

    const notificationRepo = new NotificationRepository(env.DB);
    const result = await notificationRepo.listForAdmin({ unreadOnly, limit });

    return success(result);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.EXPIRED) {
      return error(err.message, 401);
    }
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    await authenticateAdmin(request, env);

    const body = await request.json();
    const { type = 'system', title, content = '', link = '', metadata = null, orderId = null } = body;

    if (!title) {
      return error(MSG.COMMON.INVALID_PARAMS, 400);
    }

    const notificationRepo = new NotificationRepository(env.DB);
    const result = await notificationRepo.create({
      type,
      title,
      content,
      link,
      receiver: 'admin',
      orderId,
      metadata,
    });

    return success(result, MSG.COMMON.CREATE_SUCCESS);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.EXPIRED) {
      return error(err.message, 401);
    }
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
