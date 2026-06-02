import { recordAuditEvent } from '../lib/hono/_shared/audit-helpers.js';
import { safeJsonParse } from '../api/utils/json.js';
import { inClause } from '../api/utils/sql.js';
import { NotificationRepository } from '../repositories/NotificationRepository.js';
import { WebhookDeliveryService } from './WebhookDeliveryService.js';
import { WebhookNotificationService } from './WebhookNotificationService.js';
import { EmailService } from './EmailService.js';
import {
  getManageCustomerCacheUrls,
  getManageStatsCacheUrls,
  getManageNotificationCacheUrls,
  getManageOrderCacheUrls,
  getManageSalespersonCacheUrls,
  getManageShareCacheUrls,
  getManageSpaceCacheUrls,
  getManageTagCacheUrls,
  getDashboardCacheUrls,
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
import {
  getV1FileCacheUrls,
  getV1FolderCacheUrls,
  getV1FolderDetailCacheUrls,
} from '../lib/hono/routes/v1/cache-urls.js';
import {
  STATS_PROJECTION_SCOPES,
  SystemStatsProjectionRefreshService,
} from './SystemStatsProjectionRefreshService.js';
import { VariantSnapshotProjectionRefreshService } from './VariantSnapshotProjectionRefreshService.js';

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

function shouldRefreshManageStatsProjection(eventType) {
  return [
    'file_uploaded',
    'folder_created',
    'folder_updated',
    'folder_deleted',
    'space_created',
    'space_updated',
    'space_deleted',
    'space_file_added',
    'space_file_removed',
    'space_file_reordered',
    'space_subspace_created',
    'v1_folder_created',
    'v1_folder_updated',
    'v1_folder_deleted',
    'v1_folder_share_updated',
    'v1_file_created',
    'v1_file_updated',
    'v1_file_deleted',
    'v1_file_batch_deleted',
    'v1_file_batch_moved',
  ].includes(eventType);
}

function shouldRefreshDashboardProjection(eventType) {
  return [
    'order_created_by_admin',
    'order_created_by_sales',
    'order_updated_by_admin',
    'order_updated_by_sales',
    'order_deleted_by_admin',
    'order_status_changed_by_admin',
    'order_status_changed_by_sales',
  ].includes(eventType)
    || shouldRefreshManageStatsProjection(eventType);
}

function getVariantSnapshotRefreshTarget(eventType, event, payload) {
  if (['order_created_by_admin', 'order_created_by_sales'].includes(eventType)) {
    const orderId = resolveOrderId(event, payload);
    return orderId ? `variant:order:${orderId}` : null;
  }

  if (['order_updated_by_admin', 'order_updated_by_sales', 'order_deleted_by_admin'].includes(eventType)) {
    return 'variant:all';
  }

  return null;
}

function getPollerState(state) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  if (!(state.invalidatedUrls instanceof Set)) {
    state.invalidatedUrls = new Set();
  }
  if (state.allSalesTokens === undefined) {
    state.allSalesTokens = null;
  }
  if (!(state.salesTokensById instanceof Map)) {
    state.salesTokensById = new Map();
  }
  if (!(state.refreshedReadModels instanceof Set)) {
    state.refreshedReadModels = new Set();
  }
  if (!(state.readModelRefreshes instanceof Map)) {
    state.readModelRefreshes = new Map();
  }
  if (!state.services || typeof state.services !== 'object') {
    state.services = {};
  }

  return state;
}

function resetMemoizedSalespersonTokens(state) {
  const sharedState = getPollerState(state);
  if (!sharedState) {
    return;
  }

  sharedState.allSalesTokens = null;
  if (sharedState.salesTokensById instanceof Map) {
    sharedState.salesTokensById.clear();
  } else {
    sharedState.salesTokensById = new Map();
  }
}

async function getMemoizedSalespersonAccessTokens(db, salespersonIds = [], state) {
  const sharedState = getPollerState(state);
  const ids = [...new Set((salespersonIds || []).filter(Boolean))].sort();
  if (ids.length === 0) {
    return [];
  }

  if (!sharedState) {
    return getSalespersonAccessTokens(db, ids);
  }

  const cacheKey = ids.join(',');
  if (sharedState.salesTokensById.has(cacheKey)) {
    return await sharedState.salesTokensById.get(cacheKey);
  }

  const tokensPromise = Promise.resolve(getSalespersonAccessTokens(db, ids))
    .then((tokens) => {
      sharedState.salesTokensById.set(cacheKey, tokens);
      return tokens;
    })
    .catch((error) => {
      sharedState.salesTokensById.delete(cacheKey);
      throw error;
    });

  sharedState.salesTokensById.set(cacheKey, tokensPromise);
  return await tokensPromise;
}

async function getMemoizedAllSalespersonAccessTokens(db, state) {
  const sharedState = getPollerState(state);
  if (!sharedState) {
    return getAllSalespersonAccessTokens(db);
  }

  if (Array.isArray(sharedState.allSalesTokens)) {
    return sharedState.allSalesTokens;
  }
  if (sharedState.allSalesTokens) {
    return await sharedState.allSalesTokens;
  }

  const tokensPromise = Promise.resolve(getAllSalespersonAccessTokens(db))
    .then((tokens) => {
      sharedState.allSalesTokens = tokens;
      return tokens;
    })
    .catch((error) => {
      sharedState.allSalesTokens = null;
      throw error;
    });

  sharedState.allSalesTokens = tokensPromise;
  return await tokensPromise;
}

async function invalidateCacheOnce(urls, state) {
  const sharedState = getPollerState(state);
  const uniqueUrls = [...new Set((urls || []).filter(Boolean))];
  if (!sharedState) {
    if (uniqueUrls.length > 0) {
      await invalidateCache(uniqueUrls);
    }
    return uniqueUrls;
  }

  const freshUrls = uniqueUrls.filter((url) => {
    if (sharedState.invalidatedUrls.has(url)) {
      return false;
    }
    sharedState.invalidatedUrls.add(url);
    return true;
  });

  if (freshUrls.length > 0) {
    await invalidateCache(freshUrls);
  }

  return freshUrls;
}

async function refreshReadModels({ db, event, state }) {
  const sharedState = getPollerState(state);
  if (!sharedState) {
    return;
  }

  const eventType = String(event?.event_type || '');
  const refreshTargets = [];
  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json || null : null,
    {}
  );

  if (shouldRefreshManageStatsProjection(eventType)) {
    refreshTargets.push(`system:${STATS_PROJECTION_SCOPES.MANAGE_STATS}`);
  }
  if (shouldRefreshDashboardProjection(eventType)) {
    refreshTargets.push(`system:${STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW}`);
  }
  const variantSnapshotTarget = getVariantSnapshotRefreshTarget(eventType, event, payload);
  if (variantSnapshotTarget) {
    refreshTargets.push(variantSnapshotTarget);
  }

  for (const target of refreshTargets) {
    if (sharedState.refreshedReadModels.has(target)) {
      continue;
    }
    if (sharedState.readModelRefreshes.has(target)) {
      await sharedState.readModelRefreshes.get(target);
      continue;
    }

    const refreshPromise = (async () => {
      if (target.startsWith('system:')) {
        sharedState.services.systemStats ||= new SystemStatsProjectionRefreshService(db);
        await sharedState.services.systemStats.refresh(target.replace('system:', ''));
      } else if (target === 'variant:all') {
        sharedState.services.variantSnapshot ||= new VariantSnapshotProjectionRefreshService(db);
        await sharedState.services.variantSnapshot.refreshAll();
      } else if (target.startsWith('variant:order:')) {
        sharedState.services.variantSnapshot ||= new VariantSnapshotProjectionRefreshService(db);
        await sharedState.services.variantSnapshot.refreshByOrderId(target.replace('variant:order:', ''));
      }

      sharedState.refreshedReadModels.add(target);
    })();

    sharedState.readModelRefreshes.set(target, refreshPromise);
    try {
      await refreshPromise;
    } finally {
      sharedState.readModelRefreshes.delete(target);
    }
  }
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

function isInventoryAvailabilityCacheEvent(eventType) {
  return [
    'purchase_receipt_recorded',
    'purchase_receipt_reversed',
    'inventory_received',
    'inventory_receipt_reversed',
  ].includes(eventType);
}

async function findAffectedSpaceBindingsByProductIds(db, productIds = []) {
  const normalizedProductIds = [...new Set((productIds || []).filter(Boolean))];
  if (!db || typeof db.prepare !== 'function' || normalizedProductIds.length === 0) {
    return {
      spaceIds: [],
      parentIds: [],
    };
  }

  const placeholders = normalizedProductIds.map(() => '?').join(', ');
  const { results } = await db
    .prepare(
      `
        SELECT id, parent_id
        FROM spaces
        WHERE product_id IN (${placeholders})
      `
    )
    .bind(...normalizedProductIds)
    .all();

  const spaceIds = new Set();
  const parentIds = new Set();

  for (const row of results || []) {
    if (row?.id) {
      spaceIds.add(row.id);
    }
    if (row?.parent_id) {
      parentIds.add(row.parent_id);
    }
  }

  return {
    spaceIds: [...spaceIds],
    parentIds: [...parentIds],
  };
}

async function findProductIdsByVariantIds(db, variantIds = []) {
  const normalizedVariantIds = [...new Set((variantIds || []).filter(Boolean))];
  if (!db || typeof db.prepare !== 'function' || normalizedVariantIds.length === 0) {
    return [];
  }

  const { results } = await db
    .prepare(`
      SELECT DISTINCT product_id
      FROM product_variants
      WHERE id IN ${inClause(normalizedVariantIds)}
        AND product_id IS NOT NULL
    `)
    .bind(...normalizedVariantIds)
    .all();

  return [...new Set((results || []).map((row) => row?.product_id).filter(Boolean))];
}

async function findReceiptBindingsByIds(db, receiptIds = []) {
  const normalizedReceiptIds = [...new Set((receiptIds || []).filter(Boolean))];
  if (!db || typeof db.prepare !== 'function' || normalizedReceiptIds.length === 0) {
    return [];
  }

  const { results } = await db
    .prepare(`
      SELECT DISTINCT product_id, variant_id
      FROM purchase_receipts
      WHERE id IN ${inClause(normalizedReceiptIds)}
    `)
    .bind(...normalizedReceiptIds)
    .all();

  return results || [];
}

async function findOrderBindingsByIds(db, orderIds = []) {
  const normalizedOrderIds = [...new Set((orderIds || []).filter(Boolean))];
  if (!db || typeof db.prepare !== 'function' || normalizedOrderIds.length === 0) {
    return [];
  }

  const { results } = await db
    .prepare(`
      SELECT DISTINCT product_id, variant_id
      FROM orders
      WHERE id IN ${inClause(normalizedOrderIds)}
    `)
    .bind(...normalizedOrderIds)
    .all();

  return results || [];
}

async function resolveOrderAffectedProductIds(db, event, payload = {}) {
  const productIds = new Set(asArray(payload.product_ids || payload.product_id));
  const variantIds = new Set(asArray(payload.variant_ids || payload.variant_id));
  const orderIds = [
    ...asArray(payload.order_ids),
    ...asArray(payload.order_id),
    ...(event?.aggregate_type === 'order' && event?.aggregate_id ? [event.aggregate_id] : []),
  ];

  for (const row of await findOrderBindingsByIds(db, orderIds)) {
    if (row?.product_id) {
      productIds.add(row.product_id);
    }
    if (row?.variant_id) {
      variantIds.add(row.variant_id);
    }
  }

  for (const productId of await findProductIdsByVariantIds(db, [...variantIds])) {
    productIds.add(productId);
  }

  return [...productIds];
}

async function resolveInventoryAffectedProductIds(db, payload = {}) {
  const productIds = new Set(asArray(payload.product_ids || payload.product_id));
  const variantIds = new Set(asArray(payload.variant_ids || payload.variant_id));
  const receiptIds = [
    ...asArray(payload.purchase_receipt_id),
    ...asArray(payload.original_receipt_id),
    ...asArray(payload.receipt_id),
  ];

  for (const row of await findReceiptBindingsByIds(db, receiptIds)) {
    if (row?.product_id) {
      productIds.add(row.product_id);
    }
    if (row?.variant_id) {
      variantIds.add(row.variant_id);
    }
  }

  for (const productId of await findProductIdsByVariantIds(db, [...variantIds])) {
    productIds.add(productId);
  }

  return [...productIds];
}

async function collectProductSurfaceCacheUrls({ db, ctx, salesTokens = [], productIds = [] }) {
  const normalizedProductIds = [...new Set((productIds || []).filter(Boolean))];
  if (normalizedProductIds.length === 0) {
    return [];
  }

  const affectedSpaces = await findAffectedSpaceBindingsByProductIds(db, normalizedProductIds);
  const urls = new Set([
    ...getProductCacheUrls(ctx),
    ...getSalesProductCacheUrls(ctx, { salesTokens }),
    ...getManageSpaceCacheUrls(ctx, { productIds: normalizedProductIds }),
    ...getSalesSpaceCacheUrls(ctx, { salesTokens }),
  ]);

  for (const productId of normalizedProductIds) {
    for (const url of getSalesProductCacheUrls(ctx, { salesTokens, productId })) {
      urls.add(url);
    }
  }

  for (const spaceId of affectedSpaces.spaceIds) {
    for (const url of getManageSpaceCacheUrls(ctx, { spaceId })) {
      urls.add(url);
    }
    for (const url of getSalesSpaceCacheUrls(ctx, { salesTokens, spaceId })) {
      urls.add(url);
    }
  }

  for (const parentId of affectedSpaces.parentIds) {
    for (const url of getManageSpaceCacheUrls(ctx, { parentId })) {
      urls.add(url);
    }
    for (const url of getSalesSpaceCacheUrls(ctx, { salesTokens, spaceId: parentId })) {
      urls.add(url);
    }
  }

  return [...urls];
}

async function resolveExpandedCacheUrls({ db, event, baseUrl, payload, state }) {
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
    const salesTokens = await getMemoizedSalespersonAccessTokens(db, [resolveSalespersonId(payload)].filter(Boolean), state);
    return getSalesNotificationCacheUrls(ctx, salesTokens[0]);
  }

  if (String(event.event_type || '').startsWith('order_procurement_')) {
    const salesTokens = await getMemoizedAllSalespersonAccessTokens(db, state);
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
    const salesTokens = await getMemoizedSalespersonAccessTokens(db, [resolveSalespersonId(payload)].filter(Boolean), state);
    return getSalesOrderCacheUrls(ctx, { salesTokens });
  }

  if (isV1FolderCacheEvent(event.event_type)) {
    const parentIds = asArray(payload.parent_ids || payload.folder_ids || payload.folder_id);
    return [...new Set([
      ...getV1FolderCacheUrls(ctx, parentIds),
      ...getManageShareCacheUrls(ctx),
    ])];
  }

  if (isV1FileCacheEvent(event.event_type)) {
    const urls = new Set(
      [
        ...getV1FileCacheUrls(ctx),
        ...getV1FolderDetailCacheUrls(ctx, asArray(payload.folder_ids || payload.folder_id)),
      ]
    );
    if (payload.file_id) {
      urls.add(`${baseUrl}/api/v1/files/${payload.file_id}`);
    }
    return [...urls];
  }

  if (isSpaceCacheEvent(event.event_type)) {
    const salesTokens = await getMemoizedAllSalespersonAccessTokens(db, state);
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
    const salesTokens = await getMemoizedAllSalespersonAccessTokens(db, state);
    const productIds = asArray(payload.product_ids || payload.product_id || event.aggregate_id);
    return collectProductSurfaceCacheUrls({ db, ctx, salesTokens, productIds });
  }

  if (isInventoryAvailabilityCacheEvent(event.event_type)) {
    const salesTokens = await getMemoizedAllSalespersonAccessTokens(db, state);
    const purchaseOrderId = resolvePurchaseOrderId(event, payload);
    const productIds = await resolveInventoryAffectedProductIds(db, payload);
    const urls = new Set([
      ...getPurchaseOrderCacheUrls(ctx, purchaseOrderId),
      ...getOrderAnalyticsCacheUrls(ctx),
    ]);

    for (const url of await collectProductSurfaceCacheUrls({ db, ctx, salesTokens, productIds })) {
      urls.add(url);
    }

    return [...urls];
  }

  return [];
}

async function auditOutboxEvent({ db, event }) {
  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json || null : null,
    {}
  );
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

async function invalidateReceiptCaches({ db, event, baseUrl, state }) {
  if (!baseUrl) return;
  await refreshReadModels({ db, event, state });

  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json || null : null,
    {}
  );

  if (isSalespersonCacheEvent(event?.event_type)) {
    resetMemoizedSalespersonTokens(state);
  }

  const projectionUrls = [];
  if (shouldRefreshManageStatsProjection(event?.event_type) || shouldRefreshDashboardProjection(event?.event_type)) {
    const projectionCtx = createBaseContext(baseUrl);
    if (shouldRefreshManageStatsProjection(event?.event_type)) {
      projectionUrls.push(...getManageStatsCacheUrls(projectionCtx));
    }
    if (shouldRefreshDashboardProjection(event?.event_type)) {
      projectionUrls.push(...getDashboardCacheUrls(projectionCtx));
    }
  }

  if (isOrderMutationEvent(event?.event_type)) {
    const ctx = createCacheContext(baseUrl);
    const salesTokens = await getMemoizedSalespersonAccessTokens(db, [resolveSalespersonId(payload)].filter(Boolean), state);
    const allSalesTokens = await getMemoizedAllSalespersonAccessTokens(db, state);
    const affectedProductIds = await resolveOrderAffectedProductIds(db, event, payload);
    const urls = [
      ...getOrderAndSalespersonCacheUrls(ctx, { salesTokens }),
      ...getOrderNotificationCacheUrls(ctx, { salesTokens }),
      ...projectionUrls,
    ];

    for (const url of await collectProductSurfaceCacheUrls({
      db,
      ctx,
      salesTokens: allSalesTokens,
      productIds: affectedProductIds,
    })) {
      urls.push(url);
    }

    await invalidateCacheOnce([...new Set(urls)], state);
    return;
  }

  const expandedUrls = await resolveExpandedCacheUrls({ db, event, baseUrl, payload, state });
  if (expandedUrls.length > 0 || projectionUrls.length > 0) {
    await invalidateCacheOnce([...new Set([
      ...expandedUrls,
      ...projectionUrls,
    ])], state);
    return;
  }

  const purchaseOrderId = resolvePurchaseOrderId(event, payload);
  const ctx = createCacheContext(baseUrl, purchaseOrderId);
  const urls = [
    ...getPurchaseOrderCacheUrls(ctx, purchaseOrderId),
    ...getOrderAnalyticsCacheUrls(ctx),
    ...projectionUrls,
  ];

  await invalidateCacheOnce([...new Set(urls)], state);
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
    case 'order_delivery_confirmed':
      return 'Delivery confirmed';
    case 'order_return_created':
      return 'Return created';
    case 'order_return_restocked':
      return 'Return restocked';
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
    return `Order ${payload.order_no || payload.order_id || ''} has been assigned to you`.trim();
  }

  if (event?.event_type === 'order_delivery_confirmed') {
    return `Order ${payload.order_no || payload.order_id || ''} delivery has been confirmed`.trim();
  }

  if (event?.event_type === 'order_return_created') {
    return `Order ${payload.order_no || payload.order_id || ''} has a return for ${payload.quantity || 0} unit(s)`.trim();
  }

  if (event?.event_type === 'order_return_restocked') {
    return `Returned stock for order ${payload.order_no || payload.order_id || ''} has been restocked`.trim();
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

async function notifyOutboxEvent({ db, event, baseUrl, state }) {
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

async function webhookOutboxEvent({ db, event }) {
  const service = new WebhookDeliveryService(db);
  const result = await service.deliverDomainEvent(event);

  if (result?.shouldRetry) {
    throw new Error('retryable webhook delivery failures remain');
  }

  return result;
}

// 需要推送到通知渠道的事件类型
const CHANNEL_NOTIFY_EVENTS = new Set([
  'order_created_by_admin',
  'order_created_by_sales',
  'order_status_changed_by_admin',
  'order_status_changed_by_sales',
  'order_comment_created_by_admin',
  'order_delivery_confirmed',
]);

async function channelNotifyOutboxEvent({ db, event }) {
  const eventType = event?.event_type;
  if (!CHANNEL_NOTIFY_EVENTS.has(eventType)) return null;

  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json : null,
    {}
  );

  const service = new WebhookNotificationService(db);
  return service.notify(eventType, payload);
}

// 需要发送邮件通知的事件类型
const EMAIL_NOTIFY_EVENTS = new Set([
  'order_created_by_sales',
  'order_status_changed_by_admin',
  'order_delivery_confirmed',
]);

async function emailNotifyOutboxEvent({ db, env, event }) {
  const eventType = event?.event_type;
  if (!EMAIL_NOTIFY_EVENTS.has(eventType)) return null;

  const payload = safeJsonParse(
    typeof event?.payload_json === 'string' ? event.payload_json : null,
    {}
  );

  // 获取客户邮箱（如果有）
  const customerEmail = payload.customer_email || payload.email || '';
  if (!customerEmail) return null;

  const emailService = new EmailService(env, { settingsRepo: null });
  const order = {
    orderNo: payload.order_no || payload.order_id,
    status: payload.status,
    quantity: payload.quantity || 0,
    createdAt: event?.occurred_at || Date.now(),
  };

  return emailService.sendOrderConfirmation(customerEmail, order);
}

export const DOMAIN_OUTBOX_CONSUMERS = {
  audit: auditOutboxEvent,
  cache: invalidateReceiptCaches,
  notification: notifyOutboxEvent,
  webhook: webhookOutboxEvent,
  channelNotify: channelNotifyOutboxEvent,
  emailNotify: emailNotifyOutboxEvent,
};
