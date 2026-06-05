/**
 * DomainOutboxConsumers — 渠道通知 consumer
 *
 * 将特定事件类型通过 WebhookNotificationService 推送到通知渠道（如企业微信）。
 */
import { safeJsonParse } from '../../api/utils/json.js';
import { WebhookNotificationService } from '../WebhookNotificationService.js';

// 需要推送到通知渠道的事件类型
const CHANNEL_NOTIFY_EVENTS = new Set([
  'order_created_by_admin',
  'order_created_by_sales',
  'order_status_changed_by_admin',
  'order_status_changed_by_sales',
  'order_comment_created_by_admin',
  'order_delivery_confirmed',
]);

export async function channelNotifyOutboxEvent({ db, event, state }) {
  const eventType = event?.event_type;
  if (!CHANNEL_NOTIFY_EVENTS.has(eventType)) return null;

  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json : null,
    {}
  );

  const serviceKey = 'WebhookNotificationService';
  const services = state?.services || {};
  if (!services[serviceKey]) {
    services[serviceKey] = new WebhookNotificationService(db);
    if (state) state.services = services;
  }
  return services[serviceKey].notify(eventType, payload);
}
