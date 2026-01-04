/**
 * 销售端订单评论 API
 * POST /api/order/:token/orders/:id/comment
 */

import { success, error } from '../../../../utils/response.js';
import { MSG } from '../../../../utils/messages.js';
import { authenticateSalesperson } from '../../../../utils/salesperson-auth.js';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { OrderTimelineRepository } from '../../../../../repositories/OrderTimelineRepository.js';
import { createOrderNotification } from '../../../../utils/order-utils.js';

/**
 * POST - 添加留言
 */
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const { token: accessToken, id: orderId } = params;

  try {
    const salesperson = await authenticateSalesperson(request, env, accessToken);
    const orderRepo = new OrderRepository(env.DB);
    const timelineRepo = new OrderTimelineRepository(env.DB);
    const body = await request.json();
    const { comment } = body;

    if (!comment || !comment.trim()) {
      return error(`${MSG.COMMON.INVALID_PARAMS}: ${MSG.COMMON.REQUIRED}`, 400);
    }

    // 验证订单归属
    const order = await orderRepo.findByIdAndSalesperson(orderId, salesperson.id);
    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    // 使用 Repository 添加时间轴记录
    await timelineRepo.addTimelineEntry(orderId, {
      actionType: 'comment',
      actorType: 'salesperson',
      actorId: salesperson.id,
      actorName: salesperson.name,
      comment: comment.trim(),
    });

    // SOTA: 设置红点 (通知管理员)
    await orderRepo.setUnread(orderId, 'sales');

    // SOTA: 创建通知 -> 通知管理端
    try {
      await createOrderNotification(env.DB, {
        event: 'ORDER_COMMENTED_BY_SALES',
        orderId,
        orderNo: order.orderNo,
        receiver: 'admin',
        actorName: salesperson.name,
      });
    } catch (e) {
      console.error('Notification creation error:', e);
    }

    return success(null, MSG.ORDER.COMMENT_ADDED);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    console.error('Order comment error:', err);
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
