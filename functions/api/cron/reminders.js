/**
 * 定时任务：智能提醒
 * 触发方式：外部 Cron 服务调用 GET/POST /api/cron/reminders
 * 鉴权：Header Authorization: Bearer <CRON_SECRET>
 */

import { success, error } from '../utils/response.js';
import { getChinaDateStr } from '../utils/date.js';
import { OrderRepository } from '../../repositories/OrderRepository.js';
import { isCronAuthorized } from '../utils/cron-auth.js';
import { DomainOutboxPublisher } from '../../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from './outbox.js';
import { inClause } from '../utils/sql.js';
import { MS_PER_DAY } from '../utils/constants.js';

async function listExistingIdempotencyKeys(db, idempotencyKeys = []) {
  const keys = [...new Set((idempotencyKeys || []).filter(Boolean))];
  if (keys.length === 0) {
    return new Set();
  }

  const { results } = await db
    .prepare(
      `SELECT idempotency_key
     FROM domain_outbox
     WHERE idempotency_key IN ${inClause(keys)}`
    )
    .bind(...keys)
    .all();

  return new Set((results || []).map((row) => row.idempotency_key).filter(Boolean));
}

function buildReminderEvent({
  eventType,
  orderId,
  orderNo,
  receiver,
  salespersonId = null,
  deadline = null,
  subType = null,
  idempotencyKey,
}) {
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
    const ONE_DAY = MS_PER_DAY;
    const THREE_DAYS = 3 * ONE_DAY;

    const outboxEvents = [];

    // 2. 检查超时未处理订单 (Pending > 24h) - 使用 Repository
    const pendingThreshold = now - ONE_DAY;
    const pendingOrders = await orderRepo.findStalePending(pendingThreshold);
    // C-R11（C-F14）：日期键用中国时区口径（业务时区）——toISOString 的 UTC
    // 日期在北京 0:00-8:00 间仍是"昨天"，会让幂等键跨日重复/漏发
    const todayKey = getChinaDateStr(now);

    for (const order of pendingOrders) {
      const idempotencyKey = `order_pending_reminder_due:${order.id}:${todayKey}`;
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

    // 3. 检查临近交货期 (3天内) - 使用 Repository
    // C-R11：同上，deadline 窗口边界用中国日期（deadline_date 是 'YYYY-MM-DD'
    // 字符串比较，与统计口径一致）
    const todayStr = getChinaDateStr(now);
    const targetStr = getChinaDateStr(now + THREE_DAYS);

    const deadlineOrders = await orderRepo.findApproachingDeadline(todayStr, targetStr);

    for (const order of deadlineOrders) {
      const deadline = order.deadline_date;

      const salesIdempotencyKey = `order_deadline_reminder_due:sales:${order.salesperson_id || ''}:${order.id}:${deadline}`;
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

      const adminIdempotencyKey = `order_deadline_reminder_due:admin:${order.id}:${deadline}`;
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

    const existingKeys = await listExistingIdempotencyKeys(
      env.DB,
      outboxEvents.map((event) => event.idempotency_key)
    );
    const freshEvents = outboxEvents.filter((event) => !existingKeys.has(event.idempotency_key));

    if (freshEvents.length > 0) {
      const publisher = new DomainOutboxPublisher(env.DB);
      await publisher.publish(freshEvents);
      await runOutboxPoller({
        env,
        requestUrl: request.url,
        workerId: `reminders:${todayKey}`,
      });
    }

    return success({
      processed: {
        pending: pendingOrders.length,
        approaching: deadlineOrders.length,
        notificationsSent: freshEvents.length,
      },
    });
  } catch (err) {
    return error(`Cron Job Failed: ${err.message}`, 500);
  }
}
