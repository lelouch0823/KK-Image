import { recordAuditEvent } from '../lib/hono/_shared/audit-helpers.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';
import { WebhookDeliveryService } from './WebhookDeliveryService.js';
import {
  getManageCustomerCacheUrls,
  getManageNotificationCacheUrls,
  getManageOrderCacheUrls,
  getManageSalespersonCacheUrls,
  getManageShareCacheUrls,
  getManageSpaceCacheUrls,
  getManageTagCacheUrls,
  getOrderAndSalespersonCacheUrls,
  getOrderNotificationCacheUrls,
  getOrderAnalyticsCacheUrls,
  getPurchaseOrderCacheUrls,
  getSalesNotificationCacheUrls,
  getSalesOrderCacheUrls,
  getSalesProductCacheUrls,
  getSalesSpaceCacheUrls,
} from '../lib/hono/routes/_shared/cache-urls.js';
import { invalidateCache, getProductCacheUrls } from '../lib/hono/middleware/cache.js';
import { getAllSalespersonAccessTokens, getSalespersonAccessTokens } from '../lib/hono/_shared/route-helpers.js';
import { getV1FileAndFolderCacheUrls, getV1FolderAndShareCacheUrls } from '../lib/hono/routes/v1/cache-urls.js';

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

function createBaseContext(baseUrl, path = '/api/manage/orders') {
  return {
    req: {
      url: `${baseUrl}${path}`,
    },
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function resolvePurchaseOrderId(event, payload) {
  return payload.purchase_order_id
    || payload.purchaseOrderId
    || payload.po_id
    || (event?.aggregate_type === 'purchase_order' ? event.aggregate_id : null)
    || null;
}

function isOrderDomainEvent(eventType) {
  return String(eventType || '').startsWith('order_');
}

function isOrderMutationEvent(eventType) {
  const normalized = String(eventType || '');
  return normalized.startsWith('order_')
    && !normalized.startsWith('order_procurement_')
    && normalized !== 'order_read_by_admin'
    && normalized !== 'order_read_by_sales';
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

function isSalespersonCacheEvent(eventType) {
  return [
    'salesperson_created',
    'salesperson_updated',
    'salesperson_deleted',
    'salesperson_token_reset',
  ].includes(eventType);
}

function isTagCacheEvent(eventType) {
  return ['tag_created', 'tag_assigned_to_file', 'tag_unassigned_from_file'].includes(eventType);
}

function isManageFolderCacheEvent(eventType) {
  return ['folder_created', 'folder_updated', 'folder_deleted'].includes(eventType);
}

function isV1FolderCacheEvent(eventType) {
  return ['v1_folder_created', 'v1_folder_updated', 'v1_folder_deleted', 'v1_folder_share_updated'].includes(eventType);
}

function isV1FileCacheEvent(eventType) {
  return ['v1_file_created', 'v1_file_updated', 'v1_file_deleted', 'v1_file_batch_deleted', 'v1_file_batch_moved'].includes(eventType);
}

function isSpaceCacheEvent(eventType) {
  return [
    'space_created',
    'space_updated',
    'space_deleted',
    'space_file_added',
    'space_file_removed',
    'space_file_reordered',
    'space_subspace_created',
  ].includes(eventType);
}

function isProductCacheEvent(eventType) {
  return [
    'product_created',
    'product_updated',
    'product_replaced',
    'product_archived',
    'product_batch_imported',
    'product_dimension_created',
    'product_dimension_updated',
    'product_dimension_archived',
    'product_dimension_value_created',
    'product_dimension_value_archived',
    'product_dimension_value_restored',
    'product_variant_image_created',
    'product_variant_image_sorted',
    'product_variant_image_primary_changed',
    'product_variant_image_deleted',
  ].includes(eventType);
}

async function resolveExpandedCacheUrls({ db, event, baseUrl, payload }) {
  const ctx = createBaseContext(baseUrl);

  if (['customer_created', 'customer_updated', 'customer_deleted'].includes(event.event_type)) {
    return getManageCustomerCacheUrls(ctx);
  }

  if (isSalespersonCacheEvent(event.event_type)) {
    return [
      ...getManageSalespersonCacheUrls(ctx),
      ...getManageOrderCacheUrls(ctx),
    ];
  }

  if (event.event_type === 'notification_read_by_admin') {
    return getManageNotificationCacheUrls(ctx);
  }

  if (event.event_type === 'notification_read_by_sales') {
    const salesTokens = await getSalespersonAccessTokens(db, [resolveSalespersonId(payload)].filter(Boolean));
    return getSalesNotificationCacheUrls(ctx, salesTokens[0]);
  }

  if (String(event.event_type || '').startsWith('order_procurement_')) {
    const salesTokens = await getAllSalespersonAccessTokens(db);
    const purchaseOrderId = resolvePurchaseOrderId(event, payload);
    return [
      ...new Set([
        ...getPurchaseOrderCacheUrls(ctx, purchaseOrderId),
        ...getOrderAndSalespersonCacheUrls(ctx, { salesTokens }),
        ...getOrderNotificationCacheUrls(ctx, { salesTokens }),
      ]),
    ];
  }

  if (isTagCacheEvent(event.event_type)) {
    return getManageTagCacheUrls(ctx);
  }

  if (isManageFolderCacheEvent(event.event_type)) {
    return getManageShareCacheUrls(ctx);
  }

  if (event.event_type === 'order_read_by_admin') {
    return getManageOrderCacheUrls(ctx);
  }

  if (event.event_type === 'order_read_by_sales') {
    const salesTokens = await getSalespersonAccessTokens(db, [resolveSalespersonId(payload)].filter(Boolean));
    return getSalesOrderCacheUrls(ctx, { salesTokens });
  }

  if (isV1FolderCacheEvent(event.event_type)) {
    return getV1FolderAndShareCacheUrls(
      ctx,
      asArray(payload.parent_ids || payload.folder_ids || payload.folder_id)
    );
  }

  if (isV1FileCacheEvent(event.event_type)) {
    const urls = new Set(
      getV1FileAndFolderCacheUrls(ctx, {
        folderIds: asArray(payload.folder_ids || payload.folder_id),
      })
    );
    if (payload.file_id) {
      urls.add(`${baseUrl}/api/v1/files/${payload.file_id}`);
    }
    return [...urls];
  }

  if (isSpaceCacheEvent(event.event_type)) {
    const salesTokens = await getAllSalespersonAccessTokens(db);
    const spaceId = payload.space_id || event.aggregate_id || null;
    return [
      ...new Set([
        ...getManageSpaceCacheUrls(ctx, {
          spaceId,
          parentId: payload.parent_id || null,
          productIds: asArray(payload.product_ids || payload.product_id),
        }),
        ...getSalesSpaceCacheUrls(ctx, { salesTokens, spaceId }),
      ]),
    ];
  }

  if (isProductCacheEvent(event.event_type)) {
    const salesTokens = await getAllSalespersonAccessTokens(db);
    const productId = payload.product_id || event.aggregate_id || null;
    const urls = new Set([
      ...getProductCacheUrls(ctx),
      ...getSalesProductCacheUrls(ctx, { salesTokens }),
    ]);
    if (productId) {
      for (const url of getSalesProductCacheUrls(ctx, { salesTokens, productId })) {
        urls.add(url);
      }
    }
    return [...urls];
  }

  return [];
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

  const expandedUrls = await resolveExpandedCacheUrls({ db, event, baseUrl, payload });
  if (expandedUrls.length > 0) {
    await invalidateCache([...new Set(expandedUrls)]);
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
    return `Order ${payload.order_no || payload.order_id || ''} has been assigned to you`.trim();
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

async function notifyOutboxEvent({ db, event, baseUrl }) {
  const payload = parsePayload(event);
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
