/**
 * 管理端订单状态更新 API
 * PATCH /api/manage/orders/:id/status
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { now } from '../../../utils/id.js';
import { authenticateAdmin } from '../../../utils/auth.js';
import { OrderTimelineRepository } from '../../../../repositories/OrderTimelineRepository.js';
import { createOrderNotification } from '../../../utils/order-utils.js';

/**
 * PATCH - 变更订单状态
 */
export async function onRequestPatch(context) {
  const { env, params, request } = context;
  const { id: orderId } = params;

  try {
    const admin = await authenticateAdmin(request, env);
    const body = await request.json();
    const { status, note } = body;

    // 验证状态是否有效 (SOTA: 使用 Zod 或简单校验)
    const ALLOWED_STATUSES = [
      'pending',
      'confirmed',
      'rejected',
      'production',
      'shipping',
      'arrived',
      'delivered',
      'completed',
      'void',
    ];
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return error(MSG.ORDER.INVALID_STATUS, 400);
    }

    // 获取当前订单
    const order = await env.DB.prepare('SELECT id, status FROM orders WHERE id = ?')
      .bind(orderId)
      .first();
    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    if (order.status === status) {
      return error(MSG.ORDER.STATUS_UNCHANGED, 400);
    }

    // 更新状态 (SOTA: Admin 操作 -> Sales 标红)
    await env.DB.prepare(
      `
            UPDATE orders SET status = ?, unread_by_sales = 1, updated_at = ? WHERE id = ?
        `
    )
      .bind(status, now(), orderId)
      .run();

    // 记录时间轴
    const timelineRepo = new OrderTimelineRepository(env.DB);
    await timelineRepo.addTimelineEntry(orderId, {
      actionType: 'status_changed',
      actorType: 'admin',
      actorId: admin.id,
      actorName: admin.name,
      oldValue: order.status,
      newValue: status,
      reason: note || null,
    });

    // SOTA: 创建通知 -> 通知销售端
    try {
      // 获取销售员 ID 和订单编号
      const orderInfo = await env.DB.prepare('SELECT salesperson_id, order_no FROM orders WHERE id = ?')
        .bind(orderId)
        .first();
      if (orderInfo?.salesperson_id) {
        await createOrderNotification(env.DB, {
          event: 'ORDER_STATUS_CHANGED',
          orderId,
          orderNo: orderInfo.order_no,
          receiver: 'sales',
          salespersonId: orderInfo.salesperson_id,
          actorName: admin.name,
          extra: { status },
        });
      }
    } catch (e) {
      console.error('Notification creation error:', e);
    }

    return success(null, MSG.ORDER.STATUS_CHANGED);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED) {
      return error(err.message, 401);
    }
    console.error('Order status change error:', err);
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
