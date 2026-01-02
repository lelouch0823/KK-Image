/**
 * 管理端添加留言 API
 * POST /api/manage/orders/:id/comment
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { now } from '../../../utils/id.js';
import { authenticateAdmin } from '../../../utils/auth.js';
import { OrderTimelineRepository } from '../../../../repositories/OrderTimelineRepository.js';

/**
 * POST - 添加留言
 */
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const { id: orderId } = params;

  try {
    const admin = await authenticateAdmin(request, env);
    const body = await request.json();
    const { comment } = body;

    if (!comment || !comment.trim()) {
      return error(MSG.COMMON.INVALID_PARAMS, 400);
    }

    // 获取当前订单
    const order = await env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    // 记录时间轴
    const timelineRepo = new OrderTimelineRepository(env.DB);
    await timelineRepo.addTimelineEntry(orderId, {
      actionType: 'comment',
      actorType: 'admin',
      actorId: admin.id || admin.sub, // JWT payload uses sub
      actorName: admin.name || 'Admin',
      comment: comment.trim(),
    });

    // SOTA: 管理员评论 -> 触发销售端未读 (unread_by_sales)
    await env.DB.prepare('UPDATE orders SET unread_by_sales = 1, updated_at = ? WHERE id = ?')
      .bind(now(), orderId)
      .run();

    return success(null, MSG.ORDER.COMMENT_ADDED);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED) {
      return error(err.message, 401);
    }
    console.error('Order comment error:', err);
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
