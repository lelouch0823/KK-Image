/**
 * 订单变更操作 (Order Mutations)
 * ==============================
 *
 * 封装所有订单相关的 INSERT/UPDATE/DELETE 操作
 *
 * @module repositories/order/mutations
 */

import { generateId, now } from '../../api/utils/id.js';
import { inClause } from '../../api/utils/sql.js';
import { assertOrderStatusTransition } from '../../api/utils/order-state-machine.js';
import { chunkArray, executeBatchChunks } from '../../lib/db/batch.js';
import { BadRequestError } from '../../lib/hono/errors.js';
import { projectOrderLineStatus } from '../../services/OrderStatusProjectionService.js';
import {
    getPrefetchedOrderLineState,
    prefetchOrderLineStates,
} from '../../services/order-procurement/order-line-prefetch.js';
import { createOrderPayloadUpsertStatement, deriveOrderSummaryFields } from './payloads.js';

export const INSUFFICIENT_VARIANT_STOCK_ERROR = 'insufficient variant stock for delivery';
export const ORDER_SHIPPED_VOID_GUARD_ERROR = 'cannot void order while shipped line quantities remain';
export const ORDER_DELIVERED_COMPLETENESS_ERROR =
    'cannot mark order delivered until all line quantities are shipped';

/**
 * 安全获取 actorType 对应的未读字段名
 * 使用白名单映射代替三元表达式，防止未来扩展时引入注入风险
 */
const UNREAD_SELF_FIELD_MAP = Object.freeze({ admin: 'unread_by_admin', sales: 'unread_by_sales' });
const UNREAD_OTHER_FIELD_MAP = Object.freeze({ admin: 'unread_by_sales', sales: 'unread_by_admin' });

function getUnreadSelfField(actorType) {
    const field = UNREAD_SELF_FIELD_MAP[actorType];
    if (!field) throw new BadRequestError(`Invalid actorType: ${actorType}`);
    return field;
}

function getUnreadOtherField(actorType) {
    const field = UNREAD_OTHER_FIELD_MAP[actorType];
    if (!field) throw new BadRequestError(`Invalid actorType: ${actorType}`);
    return field;
}

const SNAPSHOT_SPEC_KEYS = ['category', 'size', 'color', 'material', 'brand', 'series', 'remark', 'deadline'];

function buildSnapshotSpecs(data) {
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

function extractDeadlineDate(data) {
    const value = typeof data?.deadline === 'string' ? data.deadline.trim() : data?.deadline;
    return value || null;
}

function normalizeQuantity(quantity) {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return Math.trunc(parsed);
}

function normalizeLineText(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
}

function normalizeCreateLine(line = {}, fallback = {}) {
    return {
        productId: line.productId ?? fallback.productId ?? null,
        variantId: line.variantId ?? fallback.variantId ?? null,
        mainImageId: line.mainImageId ?? fallback.mainImageId ?? null,
        quantity: normalizeQuantity(line.quantity ?? line.orderedQuantity ?? fallback.quantity ?? 1),
        data: {
            name: normalizeLineText(line.name ?? line.productName, fallback.data?.name || ''),
            brand: normalizeLineText(line.brand, fallback.data?.brand || ''),
            category: normalizeLineText(line.category, fallback.data?.category || ''),
            series: normalizeLineText(line.series, fallback.data?.series || ''),
            sku: normalizeLineText(line.sku, fallback.data?.sku || ''),
            size: normalizeLineText(line.size, fallback.data?.size || ''),
            color: normalizeLineText(line.color, fallback.data?.color || ''),
            material: normalizeLineText(line.material, fallback.data?.material || ''),
            remark: normalizeLineText(line.remark, fallback.data?.remark || ''),
            deadline: normalizeLineText(line.deadline, fallback.data?.deadline || ''),
        },
    };
}

function buildCreateLines({
    lines,
    data,
    quantity,
    productId,
    variantId,
    mainImageId,
}) {
    const candidateLines = Array.isArray(lines) && lines.length > 0
        ? lines
        : (Array.isArray(data?.lines) ? data.lines : []);
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

function serializeNormalizedLines(lines = []) {
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

function buildHeaderDataFromLines(baseData = {}, normalizedLines = []) {
    const primaryLine = normalizedLines[0] || normalizeCreateLine({}, { data: baseData });
    return {
        ...baseData,
        ...primaryLine.data,
        lines: serializeNormalizedLines(normalizedLines),
    };
}

function syncImplicitSingleLineData(data = {}, {
    productId = undefined,
    variantId = undefined,
    quantity = undefined,
} = {}, existingLineState = null) {
    const rawLines = Array.isArray(data?.lines) ? data.lines.filter(Boolean) : [];
    if (rawLines.length !== 1) return data;
    if (existingLineState && Number(existingLineState.line_count ?? 0) !== 1) return data;

    const [rawLine] = rawLines;
    const normalizedLine = normalizeCreateLine({}, {
        productId: productId !== undefined ? productId : (rawLine.productId ?? null),
        variantId: variantId !== undefined ? variantId : (rawLine.variantId ?? null),
        quantity: quantity !== undefined ? quantity : (rawLine.quantity ?? rawLine.orderedQuantity ?? 1),
        data: {
            ...rawLine,
            ...data,
        },
    });

    return {
        ...data,
        lines: serializeNormalizedLines([normalizedLine]),
    };
}

async function getOrderLineState(db, orderId, prefetchedStates = null) {
    const prefetchedState = getPrefetchedOrderLineState(prefetchedStates, orderId);
    if (prefetchedState) return prefetchedState;
    if (!orderId) return null;

    const prefetched = await prefetchOrderLineStates(db, [orderId]);
    return getPrefetchedOrderLineState(prefetched, orderId);
}

async function findOrderLineIdByOrderId(db, orderId, prefetchedStates = null) {
    if (!orderId) return null;

    const row = await getOrderLineState(db, orderId, prefetchedStates);
    if (!row?.id || Number(row.line_count ?? 1) !== 1) return null;
    return row.id || null;
}

function toNonNegativeInt(value) {
    return Math.max(0, Math.trunc(Number(value) || 0));
}

function normalizeOrderLifecycleStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'delivered') return 'fulfilled';
    return normalized;
}

async function assertSalesScopedFileIds(db, fileIds, salespersonId, { orderId = null } = {}) {
    const normalizedIds = [...new Set((Array.isArray(fileIds) ? fileIds : []).filter(Boolean))];
    if (!salespersonId || normalizedIds.length === 0) return;

    const { results } = await db.prepare(
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
    ).bind(orderId || '', ...normalizedIds).all();

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

async function getOrderLineTotals(db, orderId, prefetchedStates = null) {
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

async function assertOrderStatusCompatibleWithLines(db, orderId, nextStatus, prefetchedStates = null) {
    const normalizedStatus = normalizeOrderLifecycleStatus(nextStatus);
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

async function syncCompatibilityOrderLineSnapshot(db, {
    orderId,
    data,
    productId,
    variantId,
    quantity,
    mainImageId,
    timestamp,
    prefetchedStates = null,
}) {
    const targetLine = await getOrderLineState(db, orderId, prefetchedStates);

    if (!targetLine?.id || Number(targetLine.line_count ?? 1) !== 1) {
        return db.prepare('SELECT 1').bind();
    }

    const snapshotSpecs = buildSnapshotSpecs(data);
    const snapshotSpecsJson = snapshotSpecs ? JSON.stringify(snapshotSpecs) : null;
    const fields = [
        'snapshot_name = ?',
        'snapshot_sku = ?',
        'snapshot_specs = ?',
        'updated_at = ?',
    ];
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

    return db.prepare(
        `UPDATE order_lines
         SET ${fields.join(', ')}
         WHERE id = ? AND order_id = ?`
    ).bind(...values);
}

function deriveCompatibilityLineState(status, orderedQty, existingLine = {}) {
    const ordered = normalizeQuantity(orderedQty);
    const normalizedStatus = normalizeOrderLifecycleStatus(status || 'pending');
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

async function buildCompatibilityLineProgressStatement(
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

    return db.prepare(
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
    ).bind(
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

function buildInitialOrderLineProgress(status, orderedQty) {
    const normalizedStatus = normalizeOrderLifecycleStatus(status || 'pending');
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

function buildOrderLineInsertStatement(db, {
    orderId,
    line,
    status,
    mainImageId,
    timestamp,
}) {
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

/**
 * 创建新订单
 * @param {D1Database} db
 * @param {Object} timelineRepo - OrderTimelineRepository 实例
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function create(
    db,
    timelineRepo,
    {
        id,
        orderNo,
        salespersonId,
        customerId = null,
        data,
        status = 'pending',
        mainImageId,
        quantity = 1,
        fileIds = [],
        timeline,
        productId = null,
        variantId = null,
        lines = [],
        enforceSalesFileScope = false,
    }
) {
    const timestamp = now();
    if (enforceSalesFileScope) {
        await assertSalesScopedFileIds(db, fileIds, salespersonId);
    }
    const normalizedLines = buildCreateLines({
        lines,
        data,
        quantity,
        productId,
        variantId,
        mainImageId,
    });
    const primaryLine = normalizedLines[0] || normalizeCreateLine({}, { data, quantity, productId, variantId, mainImageId });
    const normalizedQuantity = normalizedLines.reduce((sum, line) => sum + normalizeQuantity(line.quantity), 0);
    const normalizedStatus = normalizeOrderLifecycleStatus(status || 'pending') || 'pending';
    const headerData = buildHeaderDataFromLines({}, normalizedLines);
    const orderData = JSON.stringify(headerData);
    const deadlineDate = extractDeadlineDate(primaryLine.data);
    const { summaryName, summaryBrand, summarySku } = deriveOrderSummaryFields(primaryLine.data);
    const batchStatements = [];

    // 1. 插入订单
    batchStatements.push(
        db
            .prepare(
                `
        INSERT INTO orders (id, order_no, salesperson_id, customer_id, original_data, current_data, status, main_image_id, quantity, summary_name, summary_brand, summary_sku, unread_by_admin, unread_by_sales, deadline_date, created_at, updated_at, product_id, variant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?)
        `
            )
            .bind(
                id,
                orderNo,
                salespersonId,
                customerId,
                orderData,
                orderData,
                normalizedStatus,
                mainImageId,
                normalizedQuantity,
                summaryName,
                summaryBrand,
                summarySku,
                deadlineDate,
                timestamp,
                timestamp,
                normalizedLines.length === 1 ? primaryLine.productId : null,
                normalizedLines.length === 1 ? primaryLine.variantId : null
            )
    );

    normalizedLines.forEach((line) => {
        batchStatements.push(buildOrderLineInsertStatement(db, {
            orderId: id,
            line,
            status: normalizedStatus,
            mainImageId,
            timestamp,
        }));
    });

    batchStatements.push(createOrderPayloadUpsertStatement(db, {
        orderId: id,
        originalData: orderData,
        currentData: orderData,
        createdAt: timestamp,
        updatedAt: timestamp,
    }));

    // 2. 关联文件
    fileIds.forEach((fileId, index) => {
        batchStatements.push(
            db
                .prepare(
                    `
          INSERT OR IGNORE INTO order_files (id, order_id, file_id, section, sort_order, added_at)
          VALUES (?, ?, ?, 'product', ?, ?)
          `
                )
                .bind(generateId(), id, fileId, index, timestamp)
        );
    });

    // 3. 记录时间轴
    if (timeline) {
        const stmt = timelineRepo.createInsertStatement(id, timeline);
        if (stmt) batchStatements.push(stmt);
    }

    await executeBatchChunks(db, batchStatements);
    return { id, orderNo };
}

/**
 * 更新订单数据
 * @param {D1Database} db
 * @param {string} id
 * @param {Object} newData
 * @param {'admin'|'sales'} actorType
 */
export async function updateData(db, id, newData, actorType, productId = undefined, variantId = undefined) {
    const timestamp = now();
    const updateField = getUnreadOtherField(actorType);
    const deadlineDate = extractDeadlineDate(newData);
    const { summaryName, summaryBrand, summarySku } = deriveOrderSummaryFields(newData);

    const params = [JSON.stringify(newData), timestamp, summaryName, summaryBrand, summarySku, deadlineDate];

    const colsToUpdate = ['current_data = ?', `${updateField} = 1`, 'updated_at = ?', 'summary_name = ?', 'summary_brand = ?', 'summary_sku = ?', 'deadline_date = ?'];

    // SOTA: Fix update quantity column from JSON
    if (newData.quantity !== undefined) {
        colsToUpdate.push('quantity = ?');
        params.push(newData.quantity);
    }

    if (productId !== undefined) {
        colsToUpdate.push('product_id = ?');
        params.push(productId);
    }

    if (variantId !== undefined) {
        colsToUpdate.push('variant_id = ?');
        params.push(variantId === '' ? null : variantId);
    }

    let query = `
      UPDATE orders 
      SET ${colsToUpdate.join(', ')} 
    `;

    query += ` WHERE id = ?`;
    params.push(id);

    const updateStmt = db.prepare(query).bind(...params);

    const payloadStmt = createOrderPayloadUpsertStatement(db, {
        orderId: id,
        originalData: JSON.stringify(newData),
        currentData: JSON.stringify(newData),
        createdAt: timestamp,
        updatedAt: timestamp,
    });

    const lineSnapshotStatement = await syncCompatibilityOrderLineSnapshot(db, {
        orderId: id,
        data: newData,
        productId,
        variantId,
        quantity: newData?.quantity,
        mainImageId: newData?.image || newData?.image_url || null,
        timestamp,
    });

    // 原子执行：所有写操作在同一个 batch 中
    const results = await db.batch([updateStmt, payloadStmt, lineSnapshotStatement]);
    return results[0];
}

/**
 * 原子更新订单核心字段（status/current_data/绑定/文件）
 * 所有核心写入在一个 batch 中执行，避免部分成功导致不一致。
 * @param {D1Database} db
 * @param {Object} payload
 * @param {string} payload.id
 * @param {'admin'|'sales'} payload.actorType
 * @param {Object} payload.newData
 * @param {string|undefined|null} [payload.productId]
 * @param {string|undefined|null} [payload.variantId]
 * @param {string|undefined} [payload.status]
 * @param {Array<string>|undefined} [payload.fileIds]
 */
export async function updateComposite(db, {
    id,
    actorType,
    newData,
    explicitLineMutation = undefined,
    productId = undefined,
    variantId = undefined,
    salespersonId = undefined,
    status = undefined,
    fileIds = undefined,
    forceStatusTransition = false,
    inventoryService = undefined,
    enforceSalesFileScope = false,
}) {
    const timestamp = now();
    if (enforceSalesFileScope) {
        await assertSalesScopedFileIds(db, fileIds, salespersonId, { orderId: id });
    }
    const updateField = getUnreadOtherField(actorType);
    const statements = [];
    const normalizedStatus = status !== undefined
        ? (normalizeOrderLifecycleStatus(status) || status)
        : undefined;
    const orderLineStates = await prefetchOrderLineStates(db, [id]);
    const primaryOrderLineState = getPrefetchedOrderLineState(orderLineStates, id);
    const rawLines = Array.isArray(newData?.lines) ? newData.lines.filter(Boolean) : [];
    const hasExplicitLines = explicitLineMutation === undefined
        ? rawLines.length > 0
        : (Boolean(explicitLineMutation) && rawLines.length > 0);
    const normalizedLines = hasExplicitLines
        ? buildCreateLines({
            lines: rawLines,
            data: newData,
            quantity: newData?.quantity,
            productId,
            variantId,
            mainImageId: Array.isArray(fileIds) && fileIds.length > 0 ? fileIds[0] : undefined,
        })
        : [];
    const effectiveData = hasExplicitLines
        ? buildHeaderDataFromLines(newData, normalizedLines)
        : syncImplicitSingleLineData(newData, {
            productId,
            variantId,
            quantity: newData?.quantity,
        }, primaryOrderLineState);
    const effectiveQuantity = hasExplicitLines
        ? normalizedLines.reduce((sum, line) => sum + normalizeQuantity(line.quantity), 0)
        : newData?.quantity;
    const effectiveProductId = hasExplicitLines && normalizedLines.length > 1
        ? null
        : productId;
    const effectiveVariantId = hasExplicitLines && normalizedLines.length > 1
        ? null
        : variantId;

    if (status !== undefined) {
        await assertOrderStatusCompatibleWithLines(db, id, normalizedStatus, orderLineStates);
        const currentOrder = await db
            .prepare('SELECT status, variant_id, quantity FROM orders WHERE id = ?')
            .bind(id)
            .first();
        if (currentOrder?.status) {
            assertOrderStatusTransition(currentOrder.status, normalizedStatus, { forceStatusTransition });
        }
        // 注意：库存变更已迁移至行级命令 (lines.js)，此处不再处理 order-level stock delta
    }

    const { summaryName, summaryBrand, summarySku } = deriveOrderSummaryFields(effectiveData);
    const deadlineDate = extractDeadlineDate(effectiveData);
    const colsToUpdate = ['current_data = ?', `${updateField} = 1`, 'updated_at = ?', 'summary_name = ?', 'summary_brand = ?', 'summary_sku = ?', 'deadline_date = ?'];
    const params = [JSON.stringify(effectiveData), timestamp, summaryName, summaryBrand, summarySku, deadlineDate];

    if (effectiveQuantity !== undefined) {
        colsToUpdate.push('quantity = ?');
        params.push(effectiveQuantity);
    }
    if (effectiveProductId !== undefined) {
        colsToUpdate.push('product_id = ?');
        params.push(effectiveProductId);
    }
    if (effectiveVariantId !== undefined) {
        colsToUpdate.push('variant_id = ?');
        params.push(effectiveVariantId === '' ? null : effectiveVariantId);
    }
    if (salespersonId !== undefined) {
        colsToUpdate.push('salesperson_id = ?');
        params.push(salespersonId || null);
    }
    if (status !== undefined) {
        colsToUpdate.push('status = ?');
        params.push(normalizedStatus);
    }
    if (Array.isArray(fileIds)) {
        colsToUpdate.push('main_image_id = ?');
        params.push(fileIds.length > 0 ? fileIds[0] : null);
    }

    params.push(id);
    statements.push(
        db.prepare(`UPDATE orders SET ${colsToUpdate.join(', ')} WHERE id = ?`).bind(...params)
    );

    statements.push(createOrderPayloadUpsertStatement(db, {
        orderId: id,
        originalData: JSON.stringify(effectiveData),
        currentData: JSON.stringify(effectiveData),
        createdAt: timestamp,
        updatedAt: timestamp,
    }));

    if (hasExplicitLines) {
        const lineStatus = normalizeOrderLifecycleStatus(normalizedStatus || effectiveData?.status || 'pending') || 'pending';
        statements.push(db.prepare('DELETE FROM order_lines WHERE order_id = ?').bind(id));
        normalizedLines.forEach((line) => {
            statements.push(buildOrderLineInsertStatement(db, {
                orderId: id,
                line,
                status: lineStatus,
                mainImageId: Array.isArray(fileIds) ? (fileIds.length > 0 ? fileIds[0] : null) : undefined,
                timestamp,
            }));
        });
    } else {
        statements.push(
            await syncCompatibilityOrderLineSnapshot(db, {
                orderId: id,
                data: effectiveData,
                productId: effectiveProductId,
                variantId: effectiveVariantId,
                quantity: effectiveQuantity,
                mainImageId: Array.isArray(fileIds) ? (fileIds.length > 0 ? fileIds[0] : null) : undefined,
                timestamp,
                prefetchedStates: orderLineStates,
            })
        );
    }

    if (status !== undefined && !hasExplicitLines) {
        statements.push(await buildCompatibilityLineProgressStatement(
            db,
            id,
            normalizedStatus,
            effectiveQuantity,
            timestamp,
            orderLineStates
        ));
    }

    if (Array.isArray(fileIds)) {
        statements.push(db.prepare('DELETE FROM order_files WHERE order_id = ?').bind(id));
        fileIds.forEach((fileId, index) => {
            statements.push(
                db.prepare(
                    `INSERT INTO order_files (id, order_id, file_id, section, sort_order, added_at)
                     VALUES (?, ?, ?, 'product', ?, ?)`
                ).bind(generateId(), id, fileId, index, timestamp)
            );
        });
    }

    await executeBatchChunks(db, statements);
    return { success: true };
}

/**
 * 更新订单状态
 * @param {D1Database} db
 * @param {string} id
 * @param {string} newStatus
 * @param {'admin'|'sales'} actorType
 */
export async function updateStatus(db, id, newStatus, actorType, options = {}) {
    const { forceStatusTransition = false } = options;
    const timestamp = now();
    const updateField = getUnreadOtherField(actorType);
    const normalizedNextStatus = normalizeOrderLifecycleStatus(newStatus);
    const orderLineStates = await prefetchOrderLineStates(db, [id]);
    await assertOrderStatusCompatibleWithLines(db, id, normalizedNextStatus, orderLineStates);
    const currentOrder = await db
        .prepare('SELECT status, variant_id, quantity FROM orders WHERE id = ?')
        .bind(id)
        .first();
    if (currentOrder?.status) {
        assertOrderStatusTransition(currentOrder.status, normalizedNextStatus, { forceStatusTransition });
    }
    // 注意：库存变更已迁移至行级命令 (lines.js)，此处不再处理 order-level stock delta

    const lineProgressStatement = await buildCompatibilityLineProgressStatement(
        db,
        id,
        normalizedNextStatus,
        currentOrder?.quantity,
        timestamp,
        orderLineStates
    );
    await executeBatchChunks(db, [
        db
            .prepare(
                `
      UPDATE orders 
      SET status = ?, ${updateField} = 1, updated_at = ? 
      WHERE id = ?
      `
            )
            .bind(normalizedNextStatus, timestamp, id),
        lineProgressStatement,
    ]);
    return { success: true, meta: { changes: 1 } };
}

/**
 * 更新订单关联的文件 (SOTA: 使用 batch 合并删除和插入)
 * @param {D1Database} db
 * @param {string} orderId
 * @param {Array<string>} fileIds
 */
export async function updateFiles(db, orderId, fileIds) {
    const timestamp = now();
    const statements = [
        db.prepare(`DELETE FROM order_files WHERE order_id = ?`).bind(orderId)
    ];

    if (fileIds && fileIds.length > 0) {
        fileIds.forEach((fileId, index) => {
            statements.push(
                db.prepare(`
                    INSERT INTO order_files (id, order_id, file_id, section, sort_order, added_at) 
                    VALUES (?, ?, ?, 'product', ?, ?)
                `).bind(generateId(), orderId, fileId, index, timestamp)
            );
        });
    }

    await executeBatchChunks(db, statements);
}

/**
 * 批量更新订单状态
 * @param {D1Database} db
 * @param {Object} timelineRepo
 * @param {Array<string>} ids
 * @param {string} newStatus
 * @param {Object} timeline
 */
export async function batchUpdateStatus(db, timelineRepo, ids, newStatus, timeline, options = {}) {
    const { forceStatusTransition = false } = options;
    const timestamp = now();
    const batchStatements = [];
    const normalizedNextStatus = normalizeOrderLifecycleStatus(newStatus);
    const existingOrders = [];
    for (const idChunk of chunkArray(ids)) {
        const placeholders = idChunk.map(() => '?').join(',');
        const { results = [] } = await db
            .prepare(`SELECT id, status, variant_id, quantity FROM orders WHERE id IN (${placeholders})`)
            .bind(...idChunk)
            .all();
        existingOrders.push(...results);
    }
    const orderMap = new Map((existingOrders || []).map((row) => [row.id, row]));
    const orderLineStates = await prefetchOrderLineStates(db, ids);

    for (const id of ids) {
        await assertOrderStatusCompatibleWithLines(db, id, normalizedNextStatus, orderLineStates);
        const order = orderMap.get(id);
        if (order?.status) {
            assertOrderStatusTransition(order.status, normalizedNextStatus, { forceStatusTransition });
        }
    }

    for (const id of ids) {
        const order = orderMap.get(id);
        // 注意：库存变更已迁移至行级命令 (lines.js)，此处不再处理 order-level stock delta

        batchStatements.push(
            db
                .prepare(
                    `
          UPDATE orders SET status = ?, unread_by_sales = 1, updated_at = ? WHERE id = ?
          `
                )
                .bind(normalizedNextStatus, timestamp, id)
        );
        batchStatements.push(await buildCompatibilityLineProgressStatement(
            db,
            id,
            normalizedNextStatus,
            order?.quantity,
            timestamp,
            orderLineStates
        ));

        if (timeline) {
            const stmt = timelineRepo.createInsertStatement(id, { ...timeline, orderId: id });
            if (stmt) batchStatements.push(stmt);
        }
    }

    await executeBatchChunks(db, batchStatements);
}

/**
 * 标记订单为已读
 * @param {D1Database} db
 * @param {string} id
 * @param {'admin'|'sales'} actorType
 */
export async function markAsRead(db, id, actorType) {
    const field = getUnreadSelfField(actorType);
    await db.prepare(`UPDATE orders SET ${field} = 0 WHERE id = ?`).bind(id).run();
}

/**
 * 设置对方未读标记
 * @param {D1Database} db
 * @param {string} id
 * @param {'admin'|'sales'} actorType
 */
export async function setUnread(db, id, actorType) {
    const targetField = getUnreadOtherField(actorType);
    const timestamp = now();
    await db
        .prepare(`UPDATE orders SET ${targetField} = 1, updated_at = ? WHERE id = ?`)
        .bind(timestamp, id)
        .run();
}

/**
 * 归档订单（软删除）
 * 设置 archived_at 时间戳，常规查询将自动过滤已归档订单
 * @param {D1Database} db
 * @param {string} id - 订单 ID
 * @param {string} [archivedBy] - 操作人 ID
 */
export async function archive(db, id, archivedBy = null) {
    const now = Date.now();
    const result = await db.prepare(
        'UPDATE orders SET archived_at = ?, archived_by = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL'
    ).bind(now, archivedBy, now, id).run();

    if (result.meta?.changes === 0) {
        // 可能已归档或订单不存在
        const existing = await db.prepare('SELECT id, archived_at FROM orders WHERE id = ?').bind(id).first();
        if (!existing) {
            throw new BadRequestError(`订单不存在: ${id}`);
        }
        if (existing.archived_at) {
            throw new BadRequestError(`订单已归档: ${id}`);
        }
    }

    return { id, archived_at: now, archived_by: archivedBy };
}

/**
 * 恢复已归档订单
 * @param {D1Database} db
 * @param {string} id - 订单 ID
 */
export async function restore(db, id) {
    const result = await db.prepare(
        'UPDATE orders SET archived_at = NULL, archived_by = NULL, updated_at = ? WHERE id = ? AND archived_at IS NOT NULL'
    ).bind(Date.now(), id).run();

    if (result.meta?.changes === 0) {
        const existing = await db.prepare('SELECT id, archived_at FROM orders WHERE id = ?').bind(id).first();
        if (!existing) {
            throw new BadRequestError(`订单不存在: ${id}`);
        }
        throw new BadRequestError(`订单未归档，无需恢复: ${id}`);
    }

    return { id, archived_at: null };
}

/**
 * 彻底删除订单及其关联数据 (Cascading Delete)
 * @param {D1Database} db
 * @param {string} id
 */
export async function deleteWithRelations(db, id) {
    // order_line_allocations 使用 order_line_id 而非 order_id，需要通过子查询关联
    const statements = [
        db.prepare('DELETE FROM order_timeline WHERE order_id = ?').bind(id),
        db.prepare('DELETE FROM order_files WHERE order_id = ?').bind(id),
        db.prepare('DELETE FROM order_line_allocations WHERE order_line_id IN (SELECT id FROM order_lines WHERE order_id = ?)').bind(id),
        db.prepare('DELETE FROM order_lines WHERE order_id = ?').bind(id),
        db.prepare('DELETE FROM order_payloads WHERE order_id = ?').bind(id),
        db.prepare('DELETE FROM order_shipments WHERE order_id = ?').bind(id),
        db.prepare('DELETE FROM order_returns WHERE order_id = ?').bind(id),
        db.prepare('DELETE FROM orders WHERE id = ?').bind(id)
    ];

    await executeBatchChunks(db, statements);
}
