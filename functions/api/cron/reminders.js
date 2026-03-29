/**
 * 定时任务：智能提醒
 * 触发方式：外部 Cron 服务调用 GET/POST /api/cron/reminders
 * 鉴权：Header Authorization: Bearer <CRON_SECRET>
 */

import { success, error } from '../utils/response.js';
import { OrderRepository } from '../../repositories/OrderRepository.js';
import { parseJsonObject } from '../utils/json.js';
import { isCronAuthorized } from '../utils/cron-auth.js';
import { DomainOutboxPublisher } from '../../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from './outbox.js';

async function reminderAlreadyEnqueued(db, idempotencyKey) {
  const existing = await db.prepare(
    'SELECT 1 FROM domain_outbox WHERE idempotency_key = ? LIMIT 1'
  )
    .bind(idempotencyKey)
    .first();

  return Boolean(existing);
}

function buildReminderEvent({ eventType, orderId, orderNo, receiver, salespersonId = null, deadline = null, subType = null, idempotencyKey }) {
  return {
    event_type: eventType,
    aggregate_type: 'order',
    aggregate_id: orderId,
    idempotency_key: idempotencyKey,
    payload: {
      order_id: orderId,
      order_no: orderNo,
      receiver,
      salesperson_id: salespersonId,
      deadline,
      sub_type: subType,
    },
  };
}

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

    const outboxEvents = [];

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
        const idempotencyKey = `order_pending_reminder_due:${order.id}:${new Date(now).toISOString().split('T')[0]}`;
        if (!(await reminderAlreadyEnqueued(env.DB, idempotencyKey))) {
          outboxEvents.push(
            buildReminderEvent({
              eventType: 'order_pending_reminder_due',
              orderId: order.id,
              orderNo: order.order_no,
              receiver: 'admin',
              subType: 'pending_timeout',
              idempotencyKey,
            })
          );
        }
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
        const salesIdempotencyKey = `order_deadline_reminder_due:sales:${order.salesperson_id || ''}:${order.id}:${deadline}`;
        if (!(await reminderAlreadyEnqueued(env.DB, salesIdempotencyKey))) {
          outboxEvents.push(
            buildReminderEvent({
              eventType: 'order_deadline_reminder_due',
              orderId: order.id,
              orderNo: order.order_no,
              receiver: 'sales',
              salespersonId: order.salesperson_id,
              deadline,
              idempotencyKey: salesIdempotencyKey,
            })
          );
        }

        const adminIdempotencyKey = `order_deadline_reminder_due:admin:${order.id}:${deadline}`;
        if (!(await reminderAlreadyEnqueued(env.DB, adminIdempotencyKey))) {
          outboxEvents.push(
            buildReminderEvent({
              eventType: 'order_deadline_reminder_due',
              orderId: order.id,
              orderNo: order.order_no,
              receiver: 'admin',
              deadline,
              idempotencyKey: adminIdempotencyKey,
            })
          );
        }
      }
    }

    if (outboxEvents.length > 0) {
      const publisher = new DomainOutboxPublisher(env.DB);
      await publisher.publish(outboxEvents);
      await runOutboxPoller({
        env,
        requestUrl: request.url,
        workerId: `reminders:${new Date(now).toISOString().split('T')[0]}`,
      });
    }

    return success({
      processed: {
        pending: pendingOrders.length,
        approaching: deadlineOrders.length,
        notificationsSent: outboxEvents.length,
      },
    });
  } catch (err) {
    return error(`Cron Job Failed: ${err.message}`, 500);
  }
}
