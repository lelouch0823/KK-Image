/**
 * DomainOutboxConsumers — 缓存 consumer 内部辅助
 *
 * 事件类型分类和 DB 查询辅助函数，仅供 cache-consumer.js 使用。
 */
import { inClause } from '../../api/utils/sql.js';
import { asArray } from './_shared.js';

// ─── 事件类型分类 ─────────────────────────────────────────

export function isSalespersonCacheEvent(eventType) {
  return [
    'salesperson_created',
    'salesperson_updated',
    'salesperson_deleted',
    'salesperson_token_reset',
  ].includes(eventType);
}

export function isTagCacheEvent(eventType) {
  return ['tag_created', 'tag_assigned_to_file', 'tag_unassigned_from_file'].includes(eventType);
}

export function isManageFolderCacheEvent(eventType) {
  return ['folder_created', 'folder_updated', 'folder_deleted', 'folder_share_updated'].includes(
    eventType
  );
}

export function isManageFileCacheEvent(eventType) {
  return [
    'file_created',
    'file_updated',
    'file_deleted',
    'file_batch_deleted',
    'file_batch_moved',
  ].includes(eventType);
}

/** @deprecated v1 事件类型，保留向后兼容 */
export function isV1FolderCacheEvent(eventType) {
  return [
    'v1_folder_created',
    'v1_folder_updated',
    'v1_folder_deleted',
    'v1_folder_share_updated',
  ].includes(eventType);
}

/** @deprecated v1 事件类型，保留向后兼容 */
export function isV1FileCacheEvent(eventType) {
  return [
    'v1_file_created',
    'v1_file_updated',
    'v1_file_deleted',
    'v1_file_batch_deleted',
    'v1_file_batch_moved',
  ].includes(eventType);
}

export function isSpaceCacheEvent(eventType) {
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

export function isProductCacheEvent(eventType) {
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

export function isInventoryAvailabilityCacheEvent(eventType) {
  return [
    'purchase_receipt_recorded',
    'purchase_receipt_reversed',
    'inventory_received',
    'inventory_receipt_reversed',
  ].includes(eventType);
}

// ─── DB 查询辅助 ──────────────────────────────────────────

export async function findAffectedSpaceBindingsByProductIds(db, productIds = []) {
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

export async function findProductIdsByVariantIds(db, variantIds = []) {
  const normalizedVariantIds = [...new Set((variantIds || []).filter(Boolean))];
  if (!db || typeof db.prepare !== 'function' || normalizedVariantIds.length === 0) {
    return [];
  }

  const { results } = await db
    .prepare(
      `
      SELECT DISTINCT product_id
      FROM product_variants
      WHERE id IN ${inClause(normalizedVariantIds)}
        AND product_id IS NOT NULL
    `
    )
    .bind(...normalizedVariantIds)
    .all();

  return [...new Set((results || []).map((row) => row?.product_id).filter(Boolean))];
}

export async function findReceiptBindingsByIds(db, receiptIds = []) {
  const normalizedReceiptIds = [...new Set((receiptIds || []).filter(Boolean))];
  if (!db || typeof db.prepare !== 'function' || normalizedReceiptIds.length === 0) {
    return [];
  }

  const { results } = await db
    .prepare(
      `
      SELECT DISTINCT product_id, variant_id
      FROM purchase_receipts
      WHERE id IN ${inClause(normalizedReceiptIds)}
    `
    )
    .bind(...normalizedReceiptIds)
    .all();

  return results || [];
}

export async function findOrderBindingsByIds(db, orderIds = []) {
  const normalizedOrderIds = [...new Set((orderIds || []).filter(Boolean))];
  if (!db || typeof db.prepare !== 'function' || normalizedOrderIds.length === 0) {
    return [];
  }

  const { results } = await db
    .prepare(
      `
      SELECT DISTINCT product_id, variant_id
      FROM orders
      WHERE id IN ${inClause(normalizedOrderIds)}
    `
    )
    .bind(...normalizedOrderIds)
    .all();

  return results || [];
}

export async function resolveOrderAffectedProductIds(db, event, payload = {}) {
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

export async function resolveInventoryAffectedProductIds(db, payload = {}) {
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
