/**
 * DomainOutboxConsumers — 通知创建 consumer
 *
 * 从领域事件中解析通知标题、内容、接收人，创建通知记录并失效通知缓存。
 */
import { safeJsonParse } from '../../api/utils/json.js';
import { NotificationRepository } from '../../repositories/NotificationRepository.js';
import { getOrderNotificationCacheUrls, getManageNotificationCacheUrls } from '../../lib/hono/routes/_shared/cache-urls.js';
import {
  createCacheContext,
  getMemoizedSalespersonAccessTokens,
  invalidateCacheOnce,
  isOrderDomainEvent,
  isReminderDomainEvent,
  resolveOrderId,
  resolveSalespersonId,
} from './_shared.js';

// ─── 通知内容解析（内部） ─────────────────────────────────

function resolveNotificationTitle(eventType) {
  switch (eventType) {
    case 'admin_notification_created':
      return '';
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
    case 'order_delivery_confirmed':
      return JSON.stringify({ key: 'notification.order.deliveryConfirmed' });
    case 'order_return_created':
      return JSON.stringify({ key: 'notification.order.returnCreated' });
    case 'order_return_restocked':
      return JSON.stringify({ key: 'notification.order.returnRestocked' });
    case 'order_comment_created_by_admin':
    case 'order_comment_created_by_sales':
      return JSON.stringify({ key: 'notification.order.commented' });
    case 'purchase_receipt_recorded':
      return JSON.stringify({ key: 'notification.purchase_receipt_recorded' });
    case 'order_procurement_progressed':
      return JSON.stringify({ key: 'notification.order_procurement_progressed' });
    case 'purchase_receipt_reversed':
      return JSON.stringify({ key: 'notification.purchase_receipt_reversed' });
    case 'order_procurement_reversed':
      return JSON.stringify({ key: 'notification.order_procurement_reversed' });
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
    case 'order_delivery_confirmed':
    case 'order_return_created':
    case 'order_return_restocked':
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
  if (event?.event_type === 'admin_notification_created') {
    return payload.content || '';
  }

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
    return JSON.stringify({
      key: 'notification.order.assigned_desc',
      params: { orderNo: payload.order_no || payload.order_id || '' },
    });
  }

  if (event?.event_type === 'order_delivery_confirmed') {
    return JSON.stringify({
      key: 'notification.order.deliveryConfirmed_desc',
      params: { orderNo: payload.order_no || payload.order_id || '' },
    });
  }

  if (event?.event_type === 'order_return_created') {
    return JSON.stringify({
      key: 'notification.order.returnCreated_desc',
      params: { orderNo: payload.order_no || payload.order_id || '', quantity: payload.quantity || 0 },
    });
  }

  if (event?.event_type === 'order_return_restocked') {
    return JSON.stringify({
      key: 'notification.order.returnRestocked_desc',
      params: { orderNo: payload.order_no || payload.order_id || '' },
    });
  }

  if (event?.event_type === 'purchase_receipt_recorded') {
    return JSON.stringify({
      key: 'notification.purchase_receipt_recorded_desc',
      qty: payload.received_qty ?? '',
      purchaseOrderId: payload.purchase_order_id || '',
    });
  }

  if (event?.event_type === 'order_procurement_progressed') {
    return JSON.stringify({
      key: 'notification.order_procurement_progressed_desc',
      qty: payload.received_qty_delta ?? '',
      status: payload.order_procurement_status_after || '',
      purchaseOrderId: payload.purchase_order_id || '',
    });
  }

  if (event?.event_type === 'purchase_receipt_reversed') {
    return JSON.stringify({
      key: 'notification.purchase_receipt_reversed_desc',
      qty: payload.reversal_qty ?? '',
      purchaseOrderId: payload.purchase_order_id || '',
    });
  }

  if (event?.event_type === 'order_procurement_reversed') {
    return JSON.stringify({
      key: 'notification.order_procurement_reversed_desc',
      qty: payload.reversal_qty ?? '',
      status: payload.order_procurement_status_after || '',
      purchaseOrderId: payload.purchase_order_id || '',
    });
  }

  return '';
}

function resolveNotificationType(eventType) {
  if (eventType === 'admin_notification_created') {
    return 'system';
  }

  if (eventType === 'order_deadline_reminder_due') {
    return 'deadline';
  }

  return 'order';
}

function shouldMaterializeNotification(eventType) {
  return eventType !== 'order_return_restocked';
}

// ─── 主入口 ───────────────────────────────────────────────

export async function notifyOutboxEvent({ db, event, baseUrl, state }) {
  if (!shouldMaterializeNotification(event?.event_type)) {
    return {
      skipped: true,
      reason: 'notification_suppressed',
    };
  }

  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json || null : null,
    {}
  );
  const repo = new NotificationRepository(db);
  const isManualAdminNotification = event.event_type === 'admin_notification_created';
  const recipient = resolveNotificationRecipient(event, payload);
  const dedupeSuffix = recipient.receiver === 'sales'
    ? `sales:${recipient.salespersonId || ''}`
    : 'admin';

  const result = await repo.createFromDomainEvent({
    type: isManualAdminNotification ? (payload.type || 'system') : resolveNotificationType(event.event_type),
    title: isManualAdminNotification ? (payload.title || '') : resolveNotificationTitle(event.event_type),
    content: resolveNotificationContent(event, payload),
    link: isManualAdminNotification ? (payload.link || '') : resolveNotificationLink(event, payload, recipient),
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
      ? await getMemoizedSalespersonAccessTokens(db, [recipient.salespersonId], state)
      : [];
    const urls = recipient.receiver === 'sales'
      ? getOrderNotificationCacheUrls(ctx, { salesTokens })
      : getManageNotificationCacheUrls(ctx);
    await invalidateCacheOnce(urls, state);
  }

  return result;
}
