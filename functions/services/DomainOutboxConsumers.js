import { recordAuditEvent } from '../lib/hono/_shared/audit-helpers.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';
import { WebhookDeliveryService } from './WebhookDeliveryService.js';
import {
  getManageNotificationCacheUrls,
  getOrderAndSalespersonCacheUrls,
  getOrderNotificationCacheUrls,
  getOrderAnalyticsCacheUrls,
  getPurchaseOrderCacheUrls,
} from '../lib/hono/routes/_shared/cache-urls.js';
import { invalidateCache } from '../lib/hono/middleware/cache.js';
import { getSalespersonAccessTokens } from '../lib/hono/_shared/route-helpers.js';

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

function isOrderDomainEvent(eventType) {
  return String(eventType || '').startsWith('order_');
}

function isOrderMutationEvent(eventType) {
  const normalized = String(eventType || '');
  return normalized.startsWith('order_') && !normalized.startsWith('order_procurement_');
}

function isReminderDomainEvent(eventType) {
  return eventType === 'order_pending_reminder_due' || eventType === 'order_deadline_reminder_due';
}

function resolveOrderId(event, payload) {
  return payload.order_id || payload.orderId || (event?.aggregate_type === 'order' ? event.aggregate_id : null) || null;
}

function resolveSalespersonId(payload) {
  return payload.salesperson_id || payload.salespersonId || null;
}

function resolveAuditEventConfig(event, payload) {
  if (isOrderMutationEvent(event?.event_type)) {
    const isComment = String(event?.event_type || '').includes('comment');
    const isStatus = String(event?.event_type || '').includes('status');
    const isCreate = String(event?.event_type || '').includes('created');
    return {
      action: isComment
        ? 'order.comment.create'
        : isStatus
          ? 'order.status.change'
          : isCreate
            ? 'order.create'
            : 'order.update',
      severity: isComment ? 'normal' : 'high',
      purchaseOrderId: resolveOrderId(event, payload),
    };
  }

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

async function invalidateReceiptCaches({ db, event, baseUrl }) {
  if (!baseUrl) return;

  const payload = parsePayload(event);
  if (isOrderMutationEvent(event?.event_type)) {
    const ctx = createCacheContext(baseUrl);
    const salesTokens = await getSalespersonAccessTokens(db, [resolveSalespersonId(payload)].filter(Boolean));
    const urls = [
      ...getOrderAndSalespersonCacheUrls(ctx, { salesTokens }),
      ...getOrderNotificationCacheUrls(ctx, { salesTokens }),
    ];

    await invalidateCache([...new Set(urls)]);
    return;
  }

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
    case 'order_created_by_admin':
      return JSON.stringify({ key: 'notification.orderAssigned', params: { orderNo: '' } });
    case 'order_pending_reminder_due':
      return 'notification.reminder.pending_order_title';
    case 'order_deadline_reminder_due':
      return 'notification.reminder.deadline_title';
    case 'order_created_by_sales':
      return JSON.stringify({ key: 'notification.order.created' });
    case 'order_updated_by_admin':
    case 'order_updated_by_sales':
      return JSON.stringify({ key: 'notification.order.updated' });
    case 'order_status_changed_by_admin':
      return JSON.stringify({ key: 'notification.order.statusChanged' });
    case 'order_status_changed_by_sales':
      return JSON.stringify({ key: 'notification.order.updated' });
    case 'order_comment_created_by_admin':
    case 'order_comment_created_by_sales':
      return JSON.stringify({ key: 'notification.order.commented' });
    case 'purchase_receipt_recorded':
      return JSON.stringify({ key: 'notification.purchase_receipt_recorded' });
    case 'order_procurement_progressed':
      return JSON.stringify({ key: 'notification.order_procurement_progressed' });
    default:
      return JSON.stringify({ key: `notification.${eventType}` });
  }
}

function resolveNotificationOrderId(event, payload) {
  if (isOrderDomainEvent(event?.event_type)) {
    return resolveOrderId(event, payload);
  }
  if (payload.order_id) return payload.order_id;
  if (event?.aggregate_type === 'order' && event?.aggregate_id) return event.aggregate_id;
  return null;
}

function resolveNotificationLink(event, payload, recipient) {
  if (isReminderDomainEvent(event?.event_type)) {
    const orderId = resolveNotificationOrderId(event, payload);
    if (!orderId) return '';
    return recipient?.receiver === 'sales' ? `/orders/${orderId}` : `/admin/orders?id=${orderId}`;
  }
  if (isOrderDomainEvent(event?.event_type)) {
    const orderId = resolveNotificationOrderId(event, payload);
    if (!orderId) return '';
    return recipient?.receiver === 'sales' ? `/orders/${orderId}` : `/admin/orders?id=${orderId}`;
  }
  if (payload.purchase_order_id) {
    return `/admin/purchase-orders?id=${payload.purchase_order_id}`;
  }

  const orderId = resolveNotificationOrderId(event, payload);
  return orderId ? `/admin/orders?id=${orderId}` : '';
}

function resolveNotificationRecipient(event, payload) {
  if (isReminderDomainEvent(event?.event_type)) {
    return {
      receiver: payload.receiver === 'sales' ? 'sales' : 'admin',
      salespersonId: payload.receiver === 'sales' ? resolveSalespersonId(payload) : null,
    };
  }

  if (!isOrderDomainEvent(event?.event_type)) {
    return {
      receiver: 'admin',
      salespersonId: null,
    };
  }

  switch (event.event_type) {
    case 'order_created_by_admin':
    case 'order_updated_by_admin':
    case 'order_status_changed_by_admin':
    case 'order_comment_created_by_admin':
      return {
        receiver: 'sales',
        salespersonId: resolveSalespersonId(payload),
      };
    default:
      return {
        receiver: 'admin',
        salespersonId: null,
      };
  }
}

function resolveNotificationContent(event, payload) {
  if (event?.event_type === 'order_pending_reminder_due') {
    return JSON.stringify({
      key: 'notification.reminder.pending_order_desc',
      orderNo: payload.order_no || payload.order_id || '',
    });
  }

  if (event?.event_type === 'order_deadline_reminder_due') {
    return JSON.stringify({
      key: 'notification.reminder.deadline_desc',
      orderNo: payload.order_no || payload.order_id || '',
      deadline: payload.deadline || '',
    });
  }

  if (event?.event_type === 'order_created_by_admin') {
    return `Order ${payload.order_no || payload.order_id || ''} has been assigned to you`.trim();
  }

  return '';
}

function resolveNotificationType(eventType) {
  if (eventType === 'order_deadline_reminder_due') {
    return 'deadline';
  }

  return 'order';
}

async function notifyOutboxEvent({ db, event, baseUrl }) {
  const payload = parsePayload(event);
  const repo = new NotificationRepository(db);
  const recipient = resolveNotificationRecipient(event, payload);
  const dedupeSuffix = recipient.receiver === 'sales'
    ? `sales:${recipient.salespersonId || ''}`
    : 'admin';

  const result = await repo.createFromDomainEvent({
    type: resolveNotificationType(event.event_type),
    title: resolveNotificationTitle(event.event_type),
    content: resolveNotificationContent(event, payload),
    link: resolveNotificationLink(event, payload, recipient),
    receiver: recipient.receiver,
    salespersonId: recipient.salespersonId,
    orderId: resolveNotificationOrderId(event, payload),
    metadata: {
      eventType: event.event_type,
      payload,
    },
    sourceConsumer: 'notification',
    sourceEventId: event.event_id || event.id,
    dedupeKey: `${event.event_type}:${event.event_id || event.id}:${dedupeSuffix}`,
  });

  if (baseUrl) {
    const ctx = createCacheContext(baseUrl);
    const salesTokens = recipient.salespersonId
      ? await getSalespersonAccessTokens(db, [recipient.salespersonId])
      : [];
    const urls = recipient.receiver === 'sales'
      ? getOrderNotificationCacheUrls(ctx, { salesTokens })
      : getManageNotificationCacheUrls(ctx);
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
