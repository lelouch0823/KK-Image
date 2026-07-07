/**
 * 缓存 URL 解析器
 * 根据事件类型解析需要失效的缓存 URL
 * @module services/consumers/cache-url-resolvers
 */

import {
  getManageCustomerCacheUrls,
  getManageNotificationCacheUrls,
  getManageOrderCacheUrls,
  getManageSalespersonCacheUrls,
  getManageShareCacheUrls,
  getManageSpaceCacheUrls,
  getManageTagCacheUrls,
  getManageFileCacheUrls,
  getManageFileDetailCacheUrls,
  getManageFolderCacheUrls,
  getManageFolderDetailCacheUrls,
  getOrderAndSalespersonCacheUrls,
  getOrderNotificationCacheUrls,
  getOrderAnalyticsCacheUrls,
  getPurchaseOrderCacheUrls,
  getSalesNotificationCacheUrls,
  getSalesOrderCacheUrls,
  getSalesProductCacheUrls,
  getSalesSpaceCacheUrls,
} from '../_shared/cache-urls.js';
import { getProductCacheUrls } from '../../lib/hono/middleware/cache.js';
import {
  getV1FileCacheUrls,
  getV1FolderCacheUrls,
  getV1FolderDetailCacheUrls,
} from '../_shared/v1-cache-urls.js';
import {
  asArray,
  getMemoizedAllSalespersonAccessTokens,
  getMemoizedSalespersonAccessTokens,
  resolvePurchaseOrderId,
  resolveSalespersonId,
} from './_shared.js';
import {
  findAffectedSpaceBindingsByProductIds,
  isInventoryAvailabilityCacheEvent,
  isManageFileCacheEvent,
  isManageFolderCacheEvent,
  isProductCacheEvent,
  isSalespersonCacheEvent,
  isSpaceCacheEvent,
  isTagCacheEvent,
  isV1FileCacheEvent,
  isV1FolderCacheEvent,
  resolveInventoryAffectedProductIds,
} from './_cache-helpers.js';

// ─── 缓存 URL 收集 ───────────────────────────────────────

export async function collectProductSurfaceCacheUrls({
  db,
  ctx,
  salesTokens = [],
  productIds = [],
}) {
  const normalizedProductIds = [...new Set((productIds || []).filter(Boolean))];
  if (normalizedProductIds.length === 0) return [];

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
    for (const url of getManageSpaceCacheUrls(ctx, { spaceId })) urls.add(url);
    for (const url of getSalesSpaceCacheUrls(ctx, { salesTokens, spaceId })) urls.add(url);
  }

  for (const parentId of affectedSpaces.parentIds) {
    for (const url of getManageSpaceCacheUrls(ctx, { parentId })) urls.add(url);
    for (const url of getSalesSpaceCacheUrls(ctx, { salesTokens, spaceId: parentId }))
      urls.add(url);
  }

  return [...urls];
}

// ─── 事件类型解析器 ──────────────────────────────────────

export function resolveCustomerUrls({ ctx }) {
  return getManageCustomerCacheUrls(ctx);
}

export function resolveSalespersonUrls({ ctx }) {
  return [...getManageSalespersonCacheUrls(ctx), ...getManageOrderCacheUrls(ctx)];
}

export function resolveAdminNotificationUrls({ ctx }) {
  return getManageNotificationCacheUrls(ctx);
}

export async function resolveSalesNotificationUrls({ db, ctx, payload, state }) {
  const salesTokens = await getMemoizedSalespersonAccessTokens(
    db,
    [resolveSalespersonId(payload)].filter(Boolean),
    state
  );
  return getSalesNotificationCacheUrls(ctx, salesTokens[0]);
}

export async function resolveProcurementUrls({ db, ctx, event, payload, state }) {
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

export function resolveTagUrls({ ctx }) {
  return getManageTagCacheUrls(ctx);
}

export function resolveManageFolderUrls({ ctx, payload }) {
  const parentIds = asArray(payload.parent_ids || payload.folder_ids || payload.folder_id);
  return [
    ...new Set([...getManageFolderCacheUrls(ctx, parentIds), ...getManageShareCacheUrls(ctx)]),
  ];
}

export function resolveManageFileUrls({ ctx, baseUrl, payload }) {
  const urls = new Set([
    ...getManageFileCacheUrls(ctx),
    ...getManageFolderDetailCacheUrls(ctx, asArray(payload.folder_ids || payload.folder_id)),
  ]);
  if (payload.file_id) urls.add(`${baseUrl}/api/manage/files/${payload.file_id}`);
  return [...urls];
}

export function resolveAdminOrderUrls({ ctx }) {
  return getManageOrderCacheUrls(ctx);
}

export async function resolveSalesOrderUrls({ db, ctx, payload, state }) {
  const salesTokens = await getMemoizedSalespersonAccessTokens(
    db,
    [resolveSalespersonId(payload)].filter(Boolean),
    state
  );
  return getSalesOrderCacheUrls(ctx, { salesTokens });
}

export function resolveV1FolderUrls({ ctx, payload }) {
  const parentIds = asArray(payload.parent_ids || payload.folder_ids || payload.folder_id);
  return [
    ...new Set([
      ...getV1FolderCacheUrls(ctx, parentIds),
      ...getManageFolderCacheUrls(ctx, parentIds),
      ...getManageShareCacheUrls(ctx),
    ]),
  ];
}

export function resolveV1FileUrls({ ctx, baseUrl, payload }) {
  const fileIds = payload.file_id ? [payload.file_id] : [];
  const folderIds = asArray(payload.folder_ids || payload.folder_id);
  const urls = new Set([
    ...getV1FileCacheUrls(ctx),
    ...getManageFileCacheUrls(ctx),
    ...getV1FolderDetailCacheUrls(ctx, folderIds),
    ...getManageFolderDetailCacheUrls(ctx, folderIds),
    ...getManageFileDetailCacheUrls(ctx, fileIds),
  ]);
  if (payload.file_id) urls.add(`${baseUrl}/api/v1/files/${payload.file_id}`);
  return [...urls];
}

export async function resolveSpaceUrls({ db, ctx, event, payload, state }) {
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

export async function resolveProductUrls({ db, ctx, event, payload, state }) {
  const salesTokens = await getMemoizedAllSalespersonAccessTokens(db, state);
  const productIds = asArray(payload.product_ids || payload.product_id || event.aggregate_id);
  return collectProductSurfaceCacheUrls({ db, ctx, salesTokens, productIds });
}

export async function resolveInventoryUrls({ db, ctx, event, payload, state }) {
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

// ─── 解析器注册表 ─────────────────────────────────────────

export const CACHE_URL_RESOLVERS = [
  [
    (et) => ['customer_created', 'customer_updated', 'customer_deleted'].includes(et),
    resolveCustomerUrls,
  ],
  [(et) => isSalespersonCacheEvent(et), resolveSalespersonUrls],
  [(et) => et === 'notification_read_by_admin', resolveAdminNotificationUrls],
  [(et) => et === 'notification_read_by_sales', resolveSalesNotificationUrls],
  [(et) => String(et || '').startsWith('order_procurement_'), resolveProcurementUrls],
  [(et) => isTagCacheEvent(et), resolveTagUrls],
  [(et) => isManageFolderCacheEvent(et), resolveManageFolderUrls],
  [(et) => isManageFileCacheEvent(et), resolveManageFileUrls],
  [(et) => et === 'order_read_by_admin', resolveAdminOrderUrls],
  [(et) => et === 'order_read_by_sales', resolveSalesOrderUrls],
  [(et) => isV1FolderCacheEvent(et), resolveV1FolderUrls],
  [(et) => isV1FileCacheEvent(et), resolveV1FileUrls],
  [(et) => isSpaceCacheEvent(et), resolveSpaceUrls],
  [(et) => isProductCacheEvent(et), resolveProductUrls],
  [(et) => isInventoryAvailabilityCacheEvent(et), resolveInventoryUrls],
];
