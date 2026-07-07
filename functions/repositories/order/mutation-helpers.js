/**
 * 订单变更辅助函数 (Order Mutation Helpers)
 * ==========================================
 *
 * 纯无副作用工具函数，供 mutations.js 和 mutations-lifecycle.js 使用
 *
 * @module repositories/order/mutation-helpers
 */

import { generateId, now } from '../../api/utils/id.js';
import { inClause } from '../../api/utils/sql.js';
import { toNonNegativeInt } from '../../api/utils/number.js';
import { BadRequestError } from '../../lib/hono/errors.js';
import { chunkArray, executeBatchChunks } from '../../lib/db/batch.js';
import { projectOrderLineStatus } from '../../api/utils/order-projection.js';
import {
  getPrefetchedOrderLineState,
  prefetchOrderLineStates,
} from './line-prefetch.js';
import { normalizeOrderStatus, normalizeSnapshotText } from './helpers.js';

// ── 错误消息常量 ────────────────────────────────────────────────────

export const INSUFFICIENT_VARIANT_STOCK_ERROR = 'insufficient variant stock for delivery';
export const ORDER_SHIPPED_VOID_GUARD_ERROR =
  'cannot void order while shipped line quantities remain';
export const ORDER_DELIVERED_COMPLETENESS_ERROR =
  'cannot mark order delivered until all line quantities are shipped';
export const ARCHIVED_ORDER_MUTATION_MESSAGE = '订单已归档，请先恢复后再修改';
export const ORDER_MUTATION_BATCH_SIZE = 100;

// ── 未读字段映射 ────────────────────────────────────────────────────

const UNREAD_SELF_FIELD_MAP = Object.freeze({ admin: 'unread_by_admin', sales: 'unread_by_sales' });
const UNREAD_OTHER_FIELD_MAP = Object.freeze({
  admin: 'unread_by_sales',
  sales: 'unread_by_admin',
});

export function getUnreadSelfField(actorType) {
  const field = UNREAD_SELF_FIELD_MAP[actorType];
  if (!field) throw new BadRequestError(`Invalid actorType: ${actorType}`);
  return field;
}

export function getUnreadOtherField(actorType) {
  const field = UNREAD_OTHER_FIELD_MAP[actorType];
  if (!field) throw new BadRequestError(`Invalid actorType: ${actorType}`);
  return field;
}

// ── 归档断言 ────────────────────────────────────────────────────────

export async function assertOrderIsActiveForMutation(db, id) {
  const row = await db
    .prepare('SELECT archived_at FROM orders WHERE id = ?')
    .bind(id)
    .first();
  if (row?.archived_at) {
    throw new BadRequestError(ARCHIVED_ORDER_MUTATION_MESSAGE);
  }
}

// ── 断言语句 ────────────────────────────────────────────────────────

export function buildPreviousWriteAssertionStatement(db) {
  return db.prepare(
    "SELECT json_extract(CASE WHEN changes() = 1 THEN '{}' ELSE 'not-json' END, '$') AS guard_ok"
  );
}

export function isPreviousWriteAssertionError(error) {
  return String(error?.message || error)
    .toLowerCase()
    .includes('malformed json');
}

export function normalizeGuardedOrderUpdateError(error) {
  if (isPreviousWriteAssertionError(error)) {
    throw new BadRequestError(ARCHIVED_ORDER_MUTATION_MESSAGE);
  }
  throw error;
}

export async function verifySingleRowStatusUpdate(db, result) {
  const reportedChanges = result?.meta?.changes;
  if (reportedChanges === undefined || reportedChanges === null) return true;
  if (Number(reportedChanges) === 1) return true;

  const changesRow = await db.prepare('SELECT changes() AS changes').first();
  return Number(changesRow?.changes || 0) === 1;
}

// ── 批量执行 ────────────────────────────────────────────────────────

export async function executeGroupedBatchChunks(
  db,
  statementGroups = [],
  chunkSize = ORDER_MUTATION_BATCH_SIZE
) {
  const results = [];
  let chunk = [];

  for (const group of statementGroups) {
    if (!Array.isArray(group) || group.length === 0) continue;
    if (group.length > chunkSize) {
      throw new BadRequestError('本次批量写入过多，请拆分后重试');
    }
    if (chunk.length > 0 && chunk.length + group.length > chunkSize) {
      const chunkResults = await db.batch(chunk);
      if (Array.isArray(chunkResults)) results.push(...chunkResults);
      chunk = [];
    }
    chunk.push(...group);
  }

  if (chunk.length > 0) {
    const chunkResults = await db.batch(chunk);
    if (Array.isArray(chunkResults)) results.push(...chunkResults);
  }

  return results;
}

// ── 快照构建 ────────────────────────────────────────────────────────

const SNAPSHOT_SPEC_KEYS = [
  'category',
  'size',
  'color',
  'material',
  'brand',
  'series',
  'remark',
  'deadline',
];

export function buildSnapshotSpecs(data) {
  if (!data || typeof data !== 'object') return null;
  const specs = {};
  for (const key of SNAPSHOT_SPEC_KEYS) {
    const value = data[key];
    if (value === undefined || value === null) continue;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '' || normalized === null) continue;
    specs[key] = normalized;
  }
  return Object.keys(specs).length ? specs : null;
}

export function extractDeadlineDate(data) {
  const value = typeof data?.deadline === 'string' ? data.deadline.trim() : data?.deadline;
  return value || null;
}

// ── 行规范化 ────────────────────────────────────────────────────────

export function normalizeQuantity(quantity) {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

export function normalizeCreateLine(line = {}, fallback = {}) {
  return {
    productId: line.productId ?? fallback.productId ?? null,
    variantId: line.variantId ?? fallback.variantId ?? null,
    mainImageId: line.mainImageId ?? fallback.mainImageId ?? null,
    quantity: normalizeQuantity(line.quantity ?? line.orderedQuantity ?? fallback.quantity ?? 1),
    data: {
      name: normalizeSnapshotText(line.name ?? line.productName, fallback.data?.name || ''),
      brand: normalizeSnapshotText(line.brand, fallback.data?.brand || ''),
      category: normalizeSnapshotText(line.category, fallback.data?.category || ''),
      series: normalizeSnapshotText(line.series, fallback.data?.series || ''),
      sku: normalizeSnapshotText(line.sku, fallback.data?.sku || ''),
      size: normalizeSnapshotText(line.size, fallback.data?.size || ''),
      color: normalizeSnapshotText(line.color, fallback.data?.color || ''),
      material: normalizeSnapshotText(line.material, fallback.data?.material || ''),
      remark: normalizeSnapshotText(line.remark, fallback.data?.remark || ''),
      deadline: normalizeSnapshotText(line.deadline, fallback.data?.deadline || ''),
    },
  };
}

export function buildCreateLines({ lines, data, quantity, productId, variantId, mainImageId }) {
  const candidateLines =
    Array.isArray(lines) && lines.length > 0 ? lines : Array.isArray(data?.lines) ? data.lines : [];
  const fallback = {
    productId: productId ?? null,
    variantId: variantId ?? null,
    mainImageId: mainImageId ?? null,
    quantity,
    data,
  };

  if (candidateLines.length > 0) {
    return candidateLines.map((line) => normalizeCreateLine(line, fallback));
  }

  return [normalizeCreateLine({}, fallback)];
}

export function serializeNormalizedLines(lines = []) {
  return lines.map((line) => ({
    name: line.data.name,
    brand: line.data.brand,
    category: line.data.category,
    series: line.data.series,
    sku: line.data.sku,
    size: line.data.size,
    color: line.data.color,
    material: line.data.material,
    remark: line.data.remark,
    deadline: line.data.deadline,
    quantity: line.quantity,
    productId: line.productId,
    variantId: line.variantId,
  }));
}

export function buildHeaderDataFromLines(baseData = {}, normalizedLines = []) {
  const primaryLine = normalizedLines[0] || normalizeCreateLine({}, { data: baseData });
  return {
    ...baseData,
    ...primaryLine.data,
    lines: serializeNormalizedLines(normalizedLines),
  };
}

export function syncImplicitSingleLineData(
  data = {},
  { productId = undefined, variantId = undefined, quantity = undefined } = {},
  existingLineState = null
) {
  const rawLines = Array.isArray(data?.lines) ? data.lines.filter(Boolean) : [];
  if (rawLines.length !== 1) return data;
  if (existingLineState && Number(existingLineState.line_count ?? 0) !== 1) return data;

  const [rawLine] = rawLines;
  const normalizedLine = normalizeCreateLine(
    {},
    {
      productId: productId !== undefined ? productId : (rawLine.productId ?? null),
      variantId: variantId !== undefined ? variantId : (rawLine.variantId ?? null),
      quantity:
        quantity !== undefined ? quantity : (rawLine.quantity ?? rawLine.orderedQuantity ?? 1),
      data: {
        ...rawLine,
        ...data,
      },
    }
  );

  return {
    ...data,
    lines: serializeNormalizedLines([normalizedLine]),
  };
}

// ── 订单行状态查询 ──────────────────────────────────────────────────

export async function getOrderLineState(db, orderId, prefetchedStates = null) {
  const prefetchedState = getPrefetchedOrderLineState(prefetchedStates, orderId);
  if (prefetchedState) return prefetchedState;
  if (!orderId) return null;

  const prefetched = await prefetchOrderLineStates(db, [orderId]);
  return getPrefetchedOrderLineState(prefetched, orderId);
}

export async function findOrderLineIdByOrderId(db, orderId, prefetchedStates = null) {
  if (!orderId) return null;

  const row = await getOrderLineState(db, orderId, prefetchedStates);
  if (!row?.id || Number(row.line_count ?? 1) !== 1) return null;
  return row.id || null;
}

// ── 文件权限校验 ────────────────────────────────────────────────────

export async function assertSalesScopedFileIds(db, fileIds, salespersonId, { orderId = null } = {}) {
  const normalizedIds = [...new Set((Array.isArray(fileIds) ? fileIds : []).filter(Boolean))];
  if (!salespersonId || normalizedIds.length === 0) return;

  const { results } = await db
    .prepare(
      `SELECT
            f.id,
            f.created_by,
            EXISTS(
              SELECT 1
              FROM order_files of
              WHERE of.file_id = f.id
            ) as linked_to_any_order,
            EXISTS(
              SELECT 1
              FROM order_files of
              WHERE of.file_id = f.id
                AND of.order_id = ?
            ) as linked_to_target_order
         FROM files f
         WHERE f.id IN ${inClause(normalizedIds)}`
    )
    .bind(orderId || '', ...normalizedIds)
    .all();

  const rowsById = new Map((results || []).map((row) => [row.id, row]));
  const invalidIds = normalizedIds.filter((fileId) => {
    const row = rowsById.get(fileId);
    if (!row) return true;
    if (row.linked_to_target_order) return false;
    return !(row.created_by === salespersonId && !row.linked_to_any_order);
  });

  if (invalidIds.length > 0) {
    throw new Error(`Invalid sales file scope: ${invalidIds.join(', ')}`);
  }
}

// ── 订单行数量与状态断言 ────────────────────────────────────────────

export async function getOrderLineTotals(db, orderId, prefetchedStates = null) {
  if (!orderId) {
    return {
      ordered_qty: 0,
      shipped_qty: 0,
      cancelled_qty: 0,
      line_count: 0,
    };
  }

  const summary = await getOrderLineState(db, orderId, prefetchedStates);

  return {
    ordered_qty: toNonNegativeInt(summary?.total_ordered_qty),
    shipped_qty: toNonNegativeInt(summary?.total_shipped_qty),
    cancelled_qty: toNonNegativeInt(summary?.total_cancelled_qty),
    line_count: toNonNegativeInt(summary?.line_count),
  };
}

export async function assertOrderStatusCompatibleWithLines(
  db,
  orderId,
  nextStatus,
  prefetchedStates = null
) {
  const normalizedStatus = normalizeOrderStatus(nextStatus);
  if (!normalizedStatus) return;

  const totals = await getOrderLineTotals(db, orderId, prefetchedStates);
  if (totals.line_count <= 0) return;

  const remainingQty = Math.max(totals.ordered_qty - totals.cancelled_qty, 0);
  const shippedQty = totals.shipped_qty;

  if (normalizedStatus === 'fulfilled' && shippedQty < remainingQty) {
    throw new BadRequestError(ORDER_DELIVERED_COMPLETENESS_ERROR);
  }

  if (normalizedStatus === 'void' && shippedQty > 0) {
    throw new BadRequestError(ORDER_SHIPPED_VOID_GUARD_ERROR);
  }
}

// ── 快照同步 / 进度构建 ────────────────────────────────────────────

export async function syncCompatibilityOrderLineSnapshot(
  db,
  { orderId, data, productId, variantId, quantity, mainImageId, timestamp, prefetchedStates = null }
) {
  const targetLine = await getOrderLineState(db, orderId, prefetchedStates);

  if (!targetLine?.id || Number(targetLine.line_count ?? 1) !== 1) {
    return db.prepare('SELECT 1').bind();
  }

  const snapshotSpecs = buildSnapshotSpecs(data);
  const snapshotSpecsJson = snapshotSpecs ? JSON.stringify(snapshotSpecs) : null;
  const fields = ['snapshot_name = ?', 'snapshot_sku = ?', 'snapshot_specs = ?', 'updated_at = ?'];
  const values = [
    (data && data.name) || '',
    (data && data.sku) || null,
    snapshotSpecsJson,
    timestamp,
  ];

  if (productId !== undefined) {
    fields.push('product_id = ?');
    values.push(productId ?? null);
  }
  if (variantId !== undefined) {
    fields.push('variant_id = ?');
    values.push(variantId || null);
  }
  if (mainImageId !== undefined) {
    fields.push('snapshot_image = ?');
    values.push(mainImageId || null);
  }
  if (quantity !== undefined) {
    fields.push('ordered_qty = ?');
    values.push(normalizeQuantity(quantity));
  }

  values.push(targetLine.id, orderId);

  return db
    .prepare(
      `UPDATE order_lines
         SET ${fields.join(', ')}
         WHERE id = ? AND order_id = ?`
    )
    .bind(...values);
}

export function deriveCompatibilityLineState(status, orderedQty, existingLine = {}) {
  const ordered = normalizeQuantity(orderedQty);
  const normalizedStatus = normalizeOrderStatus(status || 'pending');
  const next = {
    ordered_qty: ordered,
    procured_qty: toNonNegativeInt(existingLine.procured_qty),
    received_qty: toNonNegativeInt(existingLine.received_qty),
    reserved_qty: toNonNegativeInt(existingLine.reserved_qty),
    shipped_qty: toNonNegativeInt(existingLine.shipped_qty),
    cancelled_qty: toNonNegativeInt(existingLine.cancelled_qty),
  };

  if (['void', 'rejected', 'cancelled'].includes(normalizedStatus)) {
    next.cancelled_qty = ordered;
    next.reserved_qty = 0;
  } else {
    next.cancelled_qty = 0;
  }

  if (['production', 'shipping', 'arrived', 'fulfilled'].includes(normalizedStatus)) {
    next.procured_qty = Math.max(next.procured_qty, ordered);
  }

  if (['arrived', 'fulfilled'].includes(normalizedStatus)) {
    next.received_qty = Math.max(next.received_qty, ordered);
  }

  if (normalizedStatus === 'fulfilled') {
    const remaining = Math.max(ordered - next.cancelled_qty, 0);
    next.shipped_qty = Math.max(next.shipped_qty, remaining);
  }

  next.display_status = projectOrderLineStatus(next);
  return next;
}

export async function buildCompatibilityLineProgressStatement(
  db,
  orderId,
  status,
  orderedQty,
  timestamp,
  prefetchedStates = null
) {
  const existingLine = await getOrderLineState(db, orderId, prefetchedStates);

  if (!existingLine?.id || Number(existingLine.line_count ?? 1) !== 1) {
    return db.prepare('SELECT 1').bind();
  }

  const next = deriveCompatibilityLineState(status, orderedQty, existingLine || {});

  return db
    .prepare(
      `UPDATE order_lines
         SET ordered_qty = ?,
             procured_qty = ?,
             received_qty = ?,
             reserved_qty = ?,
             shipped_qty = ?,
             cancelled_qty = ?,
             display_status = ?,
             updated_at = ?
         WHERE id = ? AND order_id = ?`
    )
    .bind(
      next.ordered_qty,
      next.procured_qty,
      next.received_qty,
      next.reserved_qty,
      next.shipped_qty,
      next.cancelled_qty,
      next.display_status,
      timestamp,
      existingLine.id,
      orderId
    );
}

export function buildInitialOrderLineProgress(status, orderedQty) {
  const normalizedStatus = normalizeOrderStatus(status || 'pending');
  const quantity = normalizeQuantity(orderedQty);
  const progress = {
    procured_qty: 0,
    received_qty: 0,
    reserved_qty: 0,
    shipped_qty: 0,
    cancelled_qty: 0,
    display_status: 'unprocured',
  };

  if (['void', 'rejected', 'cancelled'].includes(normalizedStatus)) {
    progress.cancelled_qty = quantity;
    progress.display_status = 'cancelled';
    return progress;
  }

  if (normalizedStatus === 'fulfilled') {
    progress.procured_qty = quantity;
    progress.received_qty = quantity;
    progress.shipped_qty = quantity;
    progress.display_status = 'completed';
    return progress;
  }

  if (normalizedStatus === 'arrived') {
    progress.procured_qty = quantity;
    progress.received_qty = quantity;
    progress.display_status = 'ready';
    return progress;
  }

  if (['production', 'shipping'].includes(normalizedStatus)) {
    progress.procured_qty = quantity;
    progress.display_status = 'fully_procured';
  }

  return progress;
}

export function buildOrderLineInsertStatement(db, { orderId, line, status, mainImageId, timestamp }) {
  const snapshotSpecs = buildSnapshotSpecs(line.data);
  const snapshotSpecsJson = snapshotSpecs ? JSON.stringify(snapshotSpecs) : null;
  const orderedQty = normalizeQuantity(line.quantity);
  const lineProgress = buildInitialOrderLineProgress(status, orderedQty);
  const orderLineId = generateId();

  return db
    .prepare(
      `
        INSERT INTO order_lines (
            id,
            order_id,
            product_id,
            variant_id,
            snapshot_name,
            snapshot_sku,
            snapshot_specs,
            snapshot_image,
            ordered_qty,
            procured_qty,
            received_qty,
            reserved_qty,
            shipped_qty,
            cancelled_qty,
            display_status,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
    )
    .bind(
      orderLineId,
      orderId,
      line.productId,
      line.variantId || null,
      line.data.name || '',
      line.data.sku || null,
      snapshotSpecsJson,
      line.mainImageId || mainImageId || null,
      orderedQty,
      lineProgress.procured_qty,
      lineProgress.received_qty,
      lineProgress.reserved_qty,
      lineProgress.shipped_qty,
      lineProgress.cancelled_qty,
      lineProgress.display_status,
      timestamp,
      timestamp
    );
}
