/**
 * DomainOutboxConsumers — 领域事件 outbox 消费者注册表
 *
 * 每个 consumer 独立负责一种副作用（审计、缓存失效、通知、Webhook 等），
 * 由 outbox 轮询器按 consumer_name 分发调用。
 *
 * 各 consumer 实现位于 ./consumers/ 目录下。
 */
import { auditOutboxEvent } from './consumers/audit-consumer.js';
import { invalidateReceiptCaches } from './consumers/cache-consumer.js';
import { notifyOutboxEvent } from './consumers/notification-consumer.js';
import { webhookOutboxEvent } from './consumers/webhook-consumer.js';
import { channelNotifyOutboxEvent } from './consumers/channel-notify-consumer.js';
import { emailNotifyOutboxEvent } from './consumers/email-consumer.js';

export const DOMAIN_OUTBOX_CONSUMERS = {
  audit: auditOutboxEvent,
  cache: invalidateReceiptCaches,
  notification: notifyOutboxEvent,
  webhook: webhookOutboxEvent,
  channelNotify: channelNotifyOutboxEvent,
  emailNotify: emailNotifyOutboxEvent,
};
