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

export async function emailNotifyOutboxEvent({ db: _db, env, event, state }) {
  const eventType = event?.event_type;
  if (!EMAIL_NOTIFY_EVENTS.has(eventType)) return null;

  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json : null,
    {}
  );

  // 获取客户邮箱（如果有）
  const customerEmail = payload.customer_email || payload.email || '';
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
