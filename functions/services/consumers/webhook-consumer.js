/**
 * DomainOutboxConsumers — Webhook 分发 consumer
 *
 * 将领域事件通过 WebhookDeliveryService 投递到外部订阅端点。
 */
import { WebhookDeliveryService } from '../WebhookDeliveryService.js';

export async function webhookOutboxEvent({ db, event, state }) {
  const serviceKey = 'WebhookDeliveryService';
  const services = state?.services || {};
  if (!services[serviceKey]) {
    services[serviceKey] = new WebhookDeliveryService(db, { env: state?.env || {} });
    if (state) state.services = services;
  }
  const service = services[serviceKey];
  const result = await service.deliverDomainEvent(event);

  if (result?.shouldRetry) {
    throw new Error('retryable webhook delivery failures remain');
  }

  return result;
}
