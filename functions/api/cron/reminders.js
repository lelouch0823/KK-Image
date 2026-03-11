/**
 * 定时任务：智能提醒
 * 触发方式：外部 Cron 服务调用 GET/POST /api/cron/reminders
 * 鉴权：Header Authorization: Bearer <CRON_SECRET>
 */

import { success, error } from '../utils/response.js';
import { OrderRepository } from '../../repositories/OrderRepository.js';
import { parseJsonObject } from '../utils/json.js';
import { isCronAuthorized } from '../utils/cron-auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  // 1. 鉴权
  if (!isCronAuthorized(request, env)) {
    return error('Unauthorized', 401);
  }

  try {
    const orderRepo = new OrderRepository(env.DB);
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const THREE_DAYS = 3 * ONE_DAY;

    const notifications = [];

    // 2. 检查超时未处理订单 (Pending > 24h) - 使用 Repository
    const pendingThreshold = now - ONE_DAY;
    const pendingOrders = await orderRepo.findStalePending(pendingThreshold);

    for (const order of pendingOrders) {
      // 检查是否已发送过提醒 (避免重复)
      const exists = await env.DB.prepare(
        `
                SELECT 1 FROM notifications 
                WHERE type = 'order' 
                AND json_extract(metadata, '$.orderId') = ?
                AND created_at > ?
            `
      )
        .bind(order.id, now - ONE_DAY)
        .first();

      if (!exists) {
        const id = crypto.randomUUID();
        notifications.push(
          env.DB.prepare(
            `
                    INSERT INTO notifications (id, type, title, content, link, is_read, receiver, salesperson_id, metadata, created_at)
                    VALUES (?, 'order', ?, ?, ?, 0, 'admin', null, ?, ?)
                `
          ).bind(
            id,
            'notification.reminder.pending_order_title',
            JSON.stringify({
              key: 'notification.reminder.pending_order_desc',
              orderNo: order.order_no,
            }),
            `/manage/orders?id=${order.id}`,
            JSON.stringify({ orderId: order.id, subType: 'pending_timeout' }),
            now
          )
        );
      }
    }

    // 3. 检查临近交货期 (3天内) - 使用 Repository
    const today = new Date();
    const targetDate = new Date(today.getTime() + THREE_DAYS);
    const todayStr = today.toISOString().split('T')[0];
    const targetStr = targetDate.toISOString().split('T')[0];

    // 注意：findApproachingDeadline 使用 LIKE 查询单个日期，这里需要扩展为范围查询
    // 暂时保留直接 SQL，后续可升级 Repository
    const { results: deadlineOrders } = await env.DB.prepare(
      `
            SELECT id, order_no, salesperson_id, current_data FROM orders 
            WHERE status IN ('confirmed', 'in_progress')
            AND json_extract(current_data, '$.deadline') BETWEEN ? AND ?
        `
    )
      .bind(todayStr, targetStr)
      .all();

    for (const order of deadlineOrders) {
      const data = parseJsonObject(order.current_data, {});
      const deadline = data.deadline;

      const exists = await env.DB.prepare(
        `
                SELECT 1 FROM notifications 
                WHERE type = 'deadline' 
                AND json_extract(metadata, '$.orderId') = ?
                AND created_at > ?
            `
      )
        .bind(order.id, now - ONE_DAY)
        .first();

      if (!exists) {
        const id = crypto.randomUUID();
        notifications.push(
          env.DB.prepare(
            `
                    INSERT INTO notifications (id, type, title, content, link, is_read, receiver, salesperson_id, metadata, created_at)
                    VALUES (?, 'deadline', ?, ?, ?, 0, 'sales', ?, ?, ?)
                `
          ).bind(
            id,
            'notification.reminder.deadline_title',
            JSON.stringify({
              key: 'notification.reminder.deadline_desc',
              orderNo: order.order_no,
              deadline,
            }),
            `/orders/${order.id}`,
            order.salesperson_id,
            JSON.stringify({ orderId: order.id, deadline }),
            now
          )
        );
        
        // SOTA: Also notify admin
        const adminId = crypto.randomUUID();
        notifications.push(
          env.DB.prepare(
            `
                    INSERT INTO notifications (id, type, title, content, link, is_read, receiver, salesperson_id, metadata, created_at)
                    VALUES (?, 'deadline', ?, ?, ?, 0, 'admin', null, ?, ?)
                `
          ).bind(
            adminId,
            'notification.reminder.deadline_title',
            JSON.stringify({
              key: 'notification.reminder.deadline_desc',
              orderNo: order.order_no,
              deadline,
            }),
            `/manage/orders?id=${order.id}`,
            JSON.stringify({ orderId: order.id, deadline }),
            now
          )
        );
      }
    }

    // 批量执行插入
    if (notifications.length > 0) {
      await env.DB.batch(notifications);
    }

    return success({
      processed: {
        pending: pendingOrders.length,
        approaching: deadlineOrders.length,
        notificationsSent: notifications.length,
      },
    });
  } catch (err) {
    return error(`Cron Job Failed: ${err.message}`, 500);
  }
}
