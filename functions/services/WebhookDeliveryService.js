import { generateHmacSignature } from '../_shared/utils.js';
import { WebhookRepository } from '../repositories/WebhookRepository.js';

function parsePayload(event = {}) {
  if (!event?.payload_json) return {};
  try {
    return JSON.parse(event.payload_json);
  } catch {
    return {};
  }
}

function classifyStatusCode(statusCode) {
  if (statusCode >= 200 && statusCode < 300) return 'delivered';
  if (statusCode >= 400 && statusCode < 500) return 'terminal';
  return 'retryable';
}

export class WebhookDeliveryService {
  constructor(db, deps = {}) {
    this.db = db;
    this.webhookRepo = deps.webhookRepo || new WebhookRepository(db);
    this.fetch = deps.fetch || globalThis.fetch;
    this.signPayload = deps.signPayload || generateHmacSignature;
    this.now = deps.now || (() => Date.now());
  }

  buildEnvelope(event = {}) {
    return {
      event_id: event.event_id || event.id,
      event_type: event.event_type,
      event_version: event.event_version ?? 1,
      occurred_at: event.occurred_at ?? null,
      aggregate: {
        type: event.aggregate_type || null,
        id: event.aggregate_id || null,
      },
      payload: parsePayload(event),
    };
  }

  async deliverDomainEvent(event) {
    const endpoints = await this.webhookRepo.listActiveByEvent(event.event_type);
    const deliveries = [];
    let shouldRetry = false;

    for (const endpoint of endpoints) {
      const deliveryKey = `${event.event_id || event.id}:${endpoint.id}:v1`;

      if (await this.webhookRepo.hasSuccessfulDelivery(endpoint.id, deliveryKey)) {
        deliveries.push({
          webhookId: endpoint.id,
          deliveryKey,
          skipped: true,
          classification: 'already_delivered',
        });
        continue;
      }

      const latestAttempt = await this.webhookRepo.getLatestAttempt(endpoint.id, deliveryKey);
      const attemptNumber = Number(latestAttempt?.attempt_number || 0) + 1;
      const payload = this.buildEnvelope(event);
      const body = JSON.stringify(payload);
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'kk-life-OutboxWebhook/1.0',
        'X-Webhook-Event': payload.event_type,
        'X-Webhook-Delivery-Key': deliveryKey,
        ...(endpoint.headers || {}),
      };

      if (endpoint.secret) {
        headers['X-Webhook-Signature'] = await this.signPayload(body, endpoint.secret);
      }

      const startedAt = this.now();

      try {
        const response = await this.fetch(endpoint.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10000),
        });
        const durationMs = Math.max(this.now() - startedAt, 0);
        const classification = classifyStatusCode(response.status);
        const success = classification === 'delivered';
        const responseText = await response.text();
        const nextRetryAt = classification === 'retryable' ? this.now() + 60_000 : null;

        await this.webhookRepo.logAttempt({
          webhookId: endpoint.id,
          eventId: payload.event_id,
          eventType: payload.event_type,
          payload,
          statusCode: response.status,
          response: responseText,
          durationMs,
          deliveryKey,
          attemptNumber,
          classification,
          nextRetryAt,
          success,
        });

        deliveries.push({
          webhookId: endpoint.id,
          deliveryKey,
          attemptNumber,
          classification,
          success,
        });

        if (classification === 'retryable') {
          shouldRetry = true;
        }
      } catch (error) {
        const durationMs = Math.max(this.now() - startedAt, 0);
        const nextRetryAt = this.now() + 60_000;

        await this.webhookRepo.logAttempt({
          webhookId: endpoint.id,
          eventId: payload.event_id,
          eventType: payload.event_type,
          payload,
          statusCode: null,
          response: String(error?.message || error || 'network error'),
          durationMs,
          deliveryKey,
          attemptNumber,
          classification: 'retryable',
          nextRetryAt,
          success: false,
        });

        deliveries.push({
          webhookId: endpoint.id,
          deliveryKey,
          attemptNumber,
          classification: 'retryable',
          success: false,
        });
        shouldRetry = true;
      }
    }

    return {
      shouldRetry,
      deliveries,
    };
  }
}
