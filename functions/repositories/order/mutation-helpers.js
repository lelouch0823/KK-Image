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

export function normalizeGuardedOrderUpdateError(error, { message } = {}) {
  if (isPreviousWriteAssertionError(error)) {
    throw new BadRequestError(message || ARCHIVED_ORDER_MUTATION_MESSAGE);
  }
  throw error;
}

// ── 行履约进度守卫 ──────────────────────────────────────────────────

export const ORDER_LINE_PROGRESS_REWRITE_CONFLICT_MESSAGE =
  '订单行存在履约进度（已收货/已预留/已发货），不能整单重构；请使用行级命令调整';

/** 订单行是否存在履约进度（收货/预留/发货任一数量大于 0） */
export function hasOrderLineFulfillmentProgress(state) {
  return (
    Number(state?.total_shipped_qty) > 0 ||
    Number(state?.total_reserved_qty) > 0 ||
    Number(state?.total_received_qty) > 0
  );
}

/**
 * 结构化重写行前的 batch 内断言语句：执行时以 DB 内的权威数据复核该订单
 * 不存在履约进度。batch 外的预读与 batch 执行之间并发的行级命令（如 shipLine）
 * 提交的进度对预读不可见，若不复核会被随后的 DELETE 无声清零；断言命中时
 * 解析 'not-json' 抛错使整个 batch 回滚（与 buildPreviousWriteAssertionStatement
 * 同一 malformed JSON 断言模式）
 */
export function buildNoFulfillmentProgressAssertionStatement(db, orderId) {
  return db
    .prepare(
      `SELECT json_extract(
         CASE WHEN NOT EXISTS (
           SELECT 1 FROM order_lines
           WHERE order_id = ?
             AND (shipped_qty > 0 OR reserved_qty > 0 OR received_qty > 0)
         ) THEN '{}' ELSE 'not-json' END,
         '$'
       ) AS guard_ok`
    )
    .bind(orderId);
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

/**
 * 手工行单价归一（审查 R2 / F2）：
 * 未绑定变体的行允许提交单价快照（unit_price），否则应收恒为 0、无法收款；
 * 绑定变体的行价格以变体售价为准，unitPrice 必须省略（下方断言强制）。
 * 金额入口与 payments 一致：两位小数、非负。
 */
export function normalizeUnitPrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

/** 绑定变体的行不允许携带 unitPrice（价格以变体售价为准） */
export function assertLineUnitPriceRule(line) {
  if (line?.variantId && line?.unitPrice !== undefined && line.unitPrice !== null) {
    throw new BadRequestError('绑定变体的行价格以变体售价为准，请勿提交 unitPrice');
  }
}

export function normalizeCreateLine(line = {}, fallback = {}) {
  const effectiveVariantId = line.variantId ?? fallback.variantId ?? null;
  const effectiveUnitPrice = normalizeUnitPrice(line.unitPrice ?? fallback.unitPrice);
  // R2：绑定变体的行价格以变体售价为准——携带 unitPrice 直接 400
  if (effectiveVariantId && effectiveUnitPrice !== null) {
    throw new BadRequestError('绑定变体的行价格以变体售价为准，请勿提交 unitPrice');
  }
  return {
    productId: line.productId ?? fallback.productId ?? null,
    variantId: effectiveVariantId,
    unitPrice: effectiveUnitPrice,
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
    // R2：手工行单价快照随行序列化，编辑弹窗可回显
    unitPrice: line.unitPrice ?? null,
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

  // void 与 rejected 同为"取消类"终态（DemandService.DEMAND_RELEASE_STATUSES）：
  // 已发货的履约事实不可被静默取消——rejected 若放行，deriveCompatibilityLineState
  // 会把 cancelled_qty 抬到 ordered 而行上仍保留 shipped_qty，进度自相矛盾
  //（审查 B6）
  if (
    (normalizedStatus === 'void' || normalizedStatus === 'rejected') &&
    shippedQty > 0
  ) {
    throw new BadRequestError(ORDER_SHIPPED_VOID_GUARD_ERROR);
  }
}

// ── 快照同步 / 进度构建 ────────────────────────────────────────────

export async function syncCompatibilityOrderLineSnapshot(
  db,
  {
    orderId,
    data,
    productId,
    variantId,
    quantity,
    unitPrice = undefined,
    mainImageId,
    timestamp,
    prefetchedStates = null
  }
) {
  const targetLine = await getOrderLineState(db, orderId, prefetchedStates);

  if (!targetLine?.id || Number(targetLine.line_count ?? 1) !== 1) {
    // 非单行订单：行级快照由显式 lines 重写路径维护，此处无操作
    //（返回语句数组保持调用方展开语义一致）
    return [db.prepare('SELECT 1').bind()];
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
  // R3（F3）：数量更新的履约下限守卫——ordered_qty 不得低于已发货/已预留/
  // 已收货进度。谓词不满足时 UPDATE 0 行，紧随的 changes 断言使整个 batch
  // 回滚并映射为 409（与 C-H3 显式行重写守卫同一闭环，覆盖纯 quantity 路径）
  let quantityFloorValue = null;

  if (productId !== undefined) {
    fields.push('product_id = ?');
    values.push(productId ?? null);
  }
  if (variantId !== undefined) {
    fields.push('variant_id = ?');
    values.push(variantId || null);
  }
  if (unitPrice !== undefined) {
    // R2（F2）：仅手工行（未绑定变体）可改 unit_price——绑定变体的行价格
    // 以变体售价为准，改价不追溯（B9），携带 unitPrice 直接 400
    if (targetLine.variant_id) {
      throw new BadRequestError('绑定变体的行价格以变体售价为准，请勿提交 unitPrice');
    }
    fields.push('unit_price = ?');
    values.push(unitPrice === null ? null : normalizeUnitPrice(unitPrice));
  }
  if (mainImageId !== undefined) {
    fields.push('snapshot_image = ?');
    values.push(mainImageId || null);
  }
  if (quantity !== undefined) {
    quantityFloorValue = normalizeQuantity(quantity);
    fields.push('ordered_qty = ?');
    values.push(quantityFloorValue);
  }

  values.push(targetLine.id, orderId);

  const whereClauses = ['id = ?', 'order_id = ?'];
  if (quantity !== undefined) {
    // 数量下限：新数量 ≥ MAX(shipped, reserved, received)，否则 0 行 + 断言回滚
    whereClauses.push(
      '? >= MAX(COALESCE(shipped_qty, 0), COALESCE(reserved_qty, 0), COALESCE(received_qty, 0))'
    );
    values.push(quantityFloorValue);
  }

  const statements = [
    db
      .prepare(
        `UPDATE order_lines
           SET ${fields.join(', ')}
           WHERE ${whereClauses.join(' AND ')}`
      )
      .bind(...values),
  ];
  if (quantity !== undefined) {
    // 0 行命中（下限守卫拒绝或行被并发删除）→ malformed json → 409
    statements.push(
      db.prepare(
        "SELECT json_extract(CASE WHEN changes() = 1 THEN '{}' ELSE 'not-json' END, '$') AS guard_ok"
      )
    );
  }
  return statements;
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
            unit_price,
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
        VALUES (?, ?, ?, ?, COALESCE(?, (SELECT price FROM product_variants WHERE id = ?)), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
    )
    .bind(
      orderLineId,
      orderId,
      line.productId,
      line.variantId || null,
      // 单价快照（迁移 0106）：优先取手工行提交的 unitPrice（R2，未绑定变体
      // 的行否则应收恒为 0）；绑定变体的行以变体当前售价为快照，后续改价
      // 不追溯影响该订单的应收/收款上限与收入统计（审查 B9）
      normalizeUnitPrice(line.unitPrice) ?? null,
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
