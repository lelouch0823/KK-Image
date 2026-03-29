import { recordAuditEvent } from '../lib/hono/_shared/audit-helpers.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';
import { WebhookDeliveryService } from './WebhookDeliveryService.js';
import {
  getManageNotificationCacheUrls,
  getOrderAnalyticsCacheUrls,
  getPurchaseOrderCacheUrls,
} from '../lib/hono/routes/_shared/cache-urls.js';
import { invalidateCache } from '../lib/hono/middleware/cache.js';

function parsePayload(event = {}) {
  if (!event?.payload_json) return {};
  try {
    return JSON.parse(event.payload_json);
  } catch {
    return {};
  }
}

function createCacheContext(baseUrl, purchaseOrderId = null) {
  const url = purchaseOrderId
    ? `${baseUrl}/api/manage/purchase-orders/${purchaseOrderId}`
    : `${baseUrl}/api/manage/purchase-orders`;

  return {
    req: {
      url,
    },
  };
}

function resolvePurchaseOrderId(event, payload) {
  return payload.purchase_order_id || payload.purchaseOrderId || payload.po_id || null;
}

function resolveAuditEventConfig(event, payload) {
  const purchaseOrderId = resolvePurchaseOrderId(event, payload)
    || payload.order_id
    || payload.orderId
    || event.aggregate_id
    || null;
  const isReversal = String(event?.event_type || '').includes('reversed');

  return {
    action: isReversal ? 'purchase_order.receipt.reverse' : 'purchase_order.receipt.create',
    severity: isReversal ? 'critical' : 'high',
    purchaseOrderId,
  };
}

async function auditOutboxEvent({ db, event }) {
  const payload = parsePayload(event);
  const auditConfig = resolveAuditEventConfig(event, payload);

  await recordAuditEvent(db, {
    domain: 'purchase-orders',
    action: auditConfig.action,
    result: 'success',
    severity: auditConfig.severity,
    targetType: 'purchase_order',
    targetId: auditConfig.purchaseOrderId,
    target_label: auditConfig.purchaseOrderId,
    summary: `Processed ${event.event_type} for purchase order ${auditConfig.purchaseOrderId}`,
    metadata: {
      eventId: event.id,
      eventType: event.event_type,
      aggregateType: event.aggregate_type,
      aggregateId: event.aggregate_id,
      purchaseOrderItemId: payload.purchase_order_item_id || null,
      orderId: payload.order_id || null,
      orderLineId: payload.order_line_id || null,
      receiptId: payload.receipt_id || payload.purchase_receipt_id || null,
      originalReceiptId: payload.original_receipt_id || null,
      reversalId: payload.reversal_id || null,
      receivedQty: payload.received_qty ?? payload.received_qty_delta ?? null,
      reversalQty: payload.reversal_qty ?? null,
      correlationId: event.correlation_id || null,
    },
  });
}

async function invalidateReceiptCaches({ event, baseUrl }) {
  if (!baseUrl) return;

  const payload = parsePayload(event);
  const purchaseOrderId = resolvePurchaseOrderId(event, payload);
  const ctx = createCacheContext(baseUrl, purchaseOrderId);
  const urls = [
    ...getPurchaseOrderCacheUrls(ctx, purchaseOrderId),
    ...getOrderAnalyticsCacheUrls(ctx),
  ];

  await invalidateCache([...new Set(urls)]);
}

function resolveNotificationTitle(eventType) {
  switch (eventType) {
    case 'purchase_receipt_recorded':
      return JSON.stringify({ key: 'notification.purchase_receipt_recorded' });
    case 'order_procurement_progressed':
      return JSON.stringify({ key: 'notification.order_procurement_progressed' });
    default:
      return JSON.stringify({ key: `notification.${eventType}` });
  }
}

function resolveNotificationOrderId(event, payload) {
  if (payload.order_id) return payload.order_id;
  if (event?.aggregate_type === 'order' && event?.aggregate_id) return event.aggregate_id;
  return null;
}

function resolveNotificationLink(event, payload) {
  if (payload.purchase_order_id) {
    return `/manage/purchase-orders/${payload.purchase_order_id}`;
  }

  const orderId = resolveNotificationOrderId(event, payload);
  return orderId ? `/manage/orders/${orderId}` : '';
}

async function notifyOutboxEvent({ db, event, baseUrl }) {
  const payload = parsePayload(event);
  const repo = new NotificationRepository(db);

  const result = await repo.createFromDomainEvent({
    type: 'order',
    title: resolveNotificationTitle(event.event_type),
    content: '',
    link: resolveNotificationLink(event, payload),
    receiver: 'admin',
    orderId: resolveNotificationOrderId(event, payload),
    metadata: {
      eventType: event.event_type,
      payload,
    },
    sourceConsumer: 'notification',
    sourceEventId: event.event_id || event.id,
    dedupeKey: `${event.event_type}:${event.event_id || event.id}:admin`,
  });

  if (baseUrl) {
    const urls = getManageNotificationCacheUrls(createCacheContext(baseUrl));
    await invalidateCache([...new Set(urls)]);
  }

  return result;
}

async function webhookOutboxEvent({ db, event }) {
  const service = new WebhookDeliveryService(db);
  const result = await service.deliverDomainEvent(event);

  if (result?.shouldRetry) {
    throw new Error('retryable webhook delivery failures remain');
  }

  return result;
}

export const DOMAIN_OUTBOX_CONSUMERS = {
  audit: auditOutboxEvent,
  cache: invalidateReceiptCaches,
  notification: notifyOutboxEvent,
  webhook: webhookOutboxEvent,
};
