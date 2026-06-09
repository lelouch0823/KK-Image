import { generateHmacSignature } from '../_shared/utils.js';
import { safeJsonParse } from '../api/utils/json.js';
import { WebhookRepository } from '../repositories/WebhookRepository.js';
import { runConcurrent } from '../lib/async/runConcurrent.js';
import {
  assertSafeExternalUrl,
  buildSafeExternalFetchOptions,
} from '../lib/hono/_shared/url-security.js';

function classifyStatusCode(statusCode) {
  if (statusCode >= 200 && statusCode < 300) return 'delivered';
  if (statusCode >= 400 && statusCode < 500) return 'terminal';
  return 'retryable';
}

const DEFAULT_ENDPOINT_CONCURRENCY = 4;

function shouldAllowLocalhostWebhook(env = {}) {
  const environment = String(env?.ENVIRONMENT || '').toLowerCase();
  return (
    environment === 'development' ||
    environment === 'test' ||
    env?.RUN_REAL_API_TESTS === '1' ||
    env?.ALLOW_LOCALHOST_WEBHOOKS === '1'
  );
}

export class WebhookDeliveryService {
  constructor(db, deps = {}) {
    this.db = db;
    this.env = deps.env || {};
    this.webhookRepo = deps.webhookRepo || new WebhookRepository(db);
    this.fetch = deps.fetch || globalThis.fetch?.bind(globalThis);
    this.signPayload = deps.signPayload || generateHmacSignature;
    this.now = deps.now || (() => Date.now());
    this.endpointConcurrency = deps.endpointConcurrency || DEFAULT_ENDPOINT_CONCURRENCY;
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
      payload: safeJsonParse(
        typeof event?.payload_json === 'string' ? event.payload_json || null : null,
        {}
      ),
    };
  }

  async deliverDomainEvent(event) {
    const endpoints = await this.webhookRepo.listActiveByEvent(event.event_type);
    const deliveryStates =
      typeof this.webhookRepo.getDeliveryStates === 'function'
        ? await this.webhookRepo.getDeliveryStates(
            endpoints.map((endpoint) => `${event.event_id || event.id}:${endpoint.id}:v1`)
          )
        : null;
    const deliveries = await runConcurrent(
      endpoints,
      async (endpoint) => {
        const deliveryKey = `${event.event_id || event.id}:${endpoint.id}:v1`;
        const deliveryState = deliveryStates?.get?.(deliveryKey) || null;

        if (
          deliveryState?.hasSuccess ||
          (await this.webhookRepo.hasSuccessfulDelivery?.(endpoint.id, deliveryKey))
        ) {
          return {
            webhookId: endpoint.id,
            deliveryKey,
            skipped: true,
            classification: 'already_delivered',
          };
        }

        const latestAttempt = deliveryState
          ? { attempt_number: deliveryState.latestAttemptNumber }
          : await this.webhookRepo.getLatestAttempt?.(endpoint.id, deliveryKey);
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
          assertSafeExternalUrl(endpoint.url, {
            allowLocalhost: shouldAllowLocalhostWebhook(this.env),
          });
          const response = await this.fetch(endpoint.url, {
            method: 'POST',
            headers,
            body,
            ...buildSafeExternalFetchOptions({ timeoutMs: 10000 }),
          });
          const durationMs = Math.max(this.now() - startedAt, 0);
          const classification = classifyStatusCode(response.status);
          const success = classification === 'delivered';
          // 限制响应体读取长度，避免读取过大响应体
          const responseText = (await response.text()).substring(0, 2000);
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

          return {
            webhookId: endpoint.id,
            deliveryKey,
            attemptNumber,
            classification,
            success,
          };
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

          return {
            webhookId: endpoint.id,
            deliveryKey,
            attemptNumber,
            classification: 'retryable',
            success: false,
          };
        }
      },
      this.endpointConcurrency
    );

    return {
      shouldRetry: deliveries.some((delivery) => delivery?.classification === 'retryable'),
      deliveries,
    };
  }
}
