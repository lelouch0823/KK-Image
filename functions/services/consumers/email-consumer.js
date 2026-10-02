/**
 * DomainOutboxConsumers — 邮件通知 consumer
 *
 * 对包含客户邮箱的特定事件类型，通过 EmailService 发送订单确认邮件。
 */
import { safeJsonParse } from '../../api/utils/json.js';
import { EmailService } from '../EmailService.js';

// 需要发送邮件通知的事件类型
const EMAIL_NOTIFY_EVENTS = new Set([
  'order_created_by_sales',
  'order_status_changed_by_admin',
  'order_delivery_confirmed',
]);


/**
 * 按订单反查客户邮箱（发布方载荷不含邮箱字段，避免每次发布都做额外查询）
 * @private
 */
async function resolveCustomerEmailByOrder(db, payload) {
  try {
    const row = await db
      .prepare(
        `SELECT c.email AS email
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE ${payload.order_id ? 'o.id = ?' : 'o.order_no = ?'}
         LIMIT 1`
      )
      .bind(payload.order_id || payload.order_no)
      .first();
    const email = String(row?.email || '').trim();
    return email || '';
  } catch (err) {
    console.error('[EmailConsumer] Failed to resolve customer email:', err?.message || err);
    return '';
  }
}

export async function emailNotifyOutboxEvent({ db, env, event, state }) {
  const eventType = event?.event_type;
  if (!EMAIL_NOTIFY_EVENTS.has(eventType)) return null;

  // L12: env 空值检查，防止 undefined 访问异常
  if (!env) return null;

  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json : null,
    {}
  );

  // 发布方载荷只携带 order_id/order_no，不包含客户邮箱：
  // 优先使用载荷字段，否则从数据库按订单反查（orders -> customers）
  let customerEmail = payload.customer_email || payload.email || '';
  if (!customerEmail && db && (payload.order_id || payload.order_no)) {
    customerEmail = await resolveCustomerEmailByOrder(db, payload);
  }
  if (!customerEmail) return null;

  const serviceKey = 'EmailService';
  const services = state?.services || {};
  if (!services[serviceKey]) {
    services[serviceKey] = new EmailService(env);
    if (state) state.services = services;
  }
  const emailService = services[serviceKey];
  const order = {
    orderNo: payload.order_no || payload.order_id,
    status: payload.status,
    quantity: payload.quantity || 0,
    createdAt: event?.occurred_at || Date.now(),
  };

  return emailService.sendOrderConfirmation(customerEmail, order);
}
