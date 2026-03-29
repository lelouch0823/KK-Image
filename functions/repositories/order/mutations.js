/**
 * 订单变更操作 (Order Mutations)
 * ==============================
 *
 * 封装所有订单相关的 INSERT/UPDATE/DELETE 操作
 *
 * @module repositories/order/mutations
 */

import { generateId, now } from '../../api/utils/id.js';
import { assertOrderStatusTransition } from '../../api/utils/order-state-machine.js';
import { InventoryService } from '../../services/InventoryService.js';
import { projectOrderLineStatus } from '../../services/OrderStatusProjectionService.js';

export const INSUFFICIENT_VARIANT_STOCK_ERROR = 'insufficient variant stock for delivery';

function getDeliveryStockDelta(oldStatus, newStatus, quantity) {
    const safeQty = Math.max(0, Number(quantity) || 0);
    if (!safeQty) return 0;
    if (oldStatus !== 'delivered' && newStatus === 'delivered') return -safeQty;
    if (oldStatus === 'delivered' && newStatus !== 'delivered') return safeQty;
    return 0;
}

function resolveInventoryService(db, options = {}) {
    return options.inventoryService || new InventoryService(db);
}

async function assertBatchDeliveryStockSufficient(inventoryService, requirementsByVariant) {
    for (const [variantId, requiredQty] of requirementsByVariant.entries()) {
        await inventoryService.assertSufficient(variantId, requiredQty);
    }
}

const SNAPSHOT_SPEC_KEYS = ['size', 'color', 'material', 'brand', 'series', 'remark', 'deadline'];

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

function normalizeQuantity(quantity) {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return Math.trunc(parsed);
}

async function findOrderLineIdByOrderId(db, orderId) {
    if (!orderId) return null;

    const row = await db
        .prepare('SELECT id FROM order_lines WHERE order_id = ? ORDER BY created_at ASC LIMIT 1')
        .bind(orderId)
        .first();

    if (!row?.id) return null;

    const lineCountRow = await db
        .prepare('SELECT COUNT(*) AS line_count FROM order_lines WHERE order_id = ?')
        .bind(orderId)
        .first();
    if (lineCountRow && Number(lineCountRow.line_count ?? 1) !== 1) return null;

    return row?.id || null;
}

function toNonNegativeInt(value) {
    return Math.max(0, Math.trunc(Number(value) || 0));
}

async function syncCompatibilityOrderLineSnapshot(db, {
    orderId,
    data,
    productId,
    variantId,
    quantity,
    mainImageId,
    timestamp,
}) {
    const targetLine = await db
        .prepare(
            `SELECT id, (SELECT COUNT(*) FROM order_lines WHERE order_id = ?) AS line_count
             FROM order_lines
             WHERE order_id = ?
             ORDER BY created_at ASC
             LIMIT 1`
        )
        .bind(orderId, orderId)
        .first();

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
    const normalizedStatus = String(status || 'pending').trim().toLowerCase();
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
        next.shipped_qty = 0;
        next.reserved_qty = 0;
    } else {
        next.cancelled_qty = 0;
    }

    if (['production', 'shipping', 'arrived', 'delivered'].includes(normalizedStatus)) {
        next.procured_qty = Math.max(next.procured_qty, ordered);
    }

    if (['arrived', 'delivered'].includes(normalizedStatus)) {
        next.received_qty = Math.max(next.received_qty, ordered);
    }

    if (normalizedStatus !== 'delivered') {
        next.shipped_qty = 0;
    } else {
        const remaining = Math.max(ordered - next.cancelled_qty, 0);
        next.shipped_qty = Math.max(next.shipped_qty, remaining);
    }

    next.display_status = projectOrderLineStatus(next);
    return next;
}

async function buildCompatibilityLineProgressStatement(db, orderId, status, orderedQty, timestamp) {
    const existingLine = await db
        .prepare(
            `SELECT id,
                    ordered_qty,
                    procured_qty,
                    received_qty,
                    reserved_qty,
                    shipped_qty,
                    cancelled_qty,
                    (SELECT COUNT(*) FROM order_lines WHERE order_id = ?) AS line_count
             FROM order_lines
             WHERE order_id = ?
             ORDER BY created_at ASC
             LIMIT 1`
        )
        .bind(orderId, orderId)
        .first();

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
    const normalizedStatus = String(status || 'pending').trim().toLowerCase();
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

    if (normalizedStatus === 'delivered') {
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
    { id, orderNo, salespersonId, data, status = 'pending', mainImageId, quantity = 1, fileIds = [], timeline, productId = null, variantId = null }
) {
    const timestamp = now();
    const normalizedQuantity = normalizeQuantity(quantity);
    const orderData = JSON.stringify(data);
    const batchStatements = [];

    // 1. 插入订单
    batchStatements.push(
        db
            .prepare(
                `
        INSERT INTO orders (id, order_no, salesperson_id, original_data, current_data, status, main_image_id, quantity, unread_by_admin, unread_by_sales, created_at, updated_at, product_id, variant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)
        `
            )
            .bind(id, orderNo, salespersonId, orderData, orderData, status, mainImageId, normalizedQuantity, timestamp, timestamp, productId, variantId)
    );

    const snapshotSpecs = buildSnapshotSpecs(data);
    const snapshotSpecsJson = snapshotSpecs ? JSON.stringify(snapshotSpecs) : null;
    const orderedQty = normalizedQuantity;
    const lineProgress = buildInitialOrderLineProgress(status, orderedQty);
    const orderLineId = generateId();
    batchStatements.push(
        db
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
                id,
                productId,
                variantId || null,
                (data && data.name) || '',
                (data && data.sku) || null,
                snapshotSpecsJson,
                mainImageId || null,
                orderedQty,
                lineProgress.procured_qty,
                lineProgress.received_qty,
                lineProgress.reserved_qty,
                lineProgress.shipped_qty,
                lineProgress.cancelled_qty,
                lineProgress.display_status,
                timestamp,
                timestamp
            )
    );

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

    await db.batch(batchStatements);
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
    const updateField = actorType === 'admin' ? 'unread_by_sales' : 'unread_by_admin';

    const params = [JSON.stringify(newData), timestamp];

    const colsToUpdate = ['current_data = ?', `${updateField} = 1`, 'updated_at = ?'];

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

    const updateResult = await db
        .prepare(query)
        .bind(...params)
        .run();

    const lineSnapshotStatement = await syncCompatibilityOrderLineSnapshot(db, {
        orderId: id,
        data: newData,
        productId,
        variantId,
        quantity: newData?.quantity,
        mainImageId: newData?.image || newData?.image_url || null,
        timestamp,
    });
    await lineSnapshotStatement.run();

    return updateResult;
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
    productId = undefined,
    variantId = undefined,
    status = undefined,
    fileIds = undefined,
    forceStatusTransition = false,
    inventoryService = undefined,
}) {
    const timestamp = now();
    const updateField = actorType === 'admin' ? 'unread_by_sales' : 'unread_by_admin';
    const statements = [];
    const stockService = inventoryService || new InventoryService(db);

    if (status !== undefined) {
        const currentOrder = await db
            .prepare('SELECT status, variant_id, quantity FROM orders WHERE id = ?')
            .bind(id)
            .first();
        if (currentOrder?.status) {
            assertOrderStatusTransition(currentOrder.status, status, { forceStatusTransition });
        }
        const stockDelta = getDeliveryStockDelta(currentOrder?.status, status, currentOrder?.quantity);
        if (currentOrder?.variant_id && stockDelta < 0) {
            await stockService.assertSufficient(currentOrder.variant_id, Math.abs(stockDelta));
        }
        if (currentOrder?.variant_id && stockDelta !== 0) {
            const orderLineId = await findOrderLineIdByOrderId(db, id);
            await stockService.applyMutation({
                type: 'order_shipment',
                variantId: currentOrder.variant_id,
                quantityDelta: stockDelta,
                orderId: id,
                orderLineId,
                referenceType: 'order',
                referenceId: id,
            });
        }
    }

    const colsToUpdate = ['current_data = ?', `${updateField} = 1`, 'updated_at = ?'];
    const params = [JSON.stringify(newData), timestamp];

    if (newData?.quantity !== undefined) {
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
    if (status !== undefined) {
        colsToUpdate.push('status = ?');
        params.push(status);
    }
    if (Array.isArray(fileIds)) {
        colsToUpdate.push('main_image_id = ?');
        params.push(fileIds.length > 0 ? fileIds[0] : null);
    }

    params.push(id);
    statements.push(
        db.prepare(`UPDATE orders SET ${colsToUpdate.join(', ')} WHERE id = ?`).bind(...params)
    );

    statements.push(
        await syncCompatibilityOrderLineSnapshot(db, {
            orderId: id,
            data: newData,
            productId,
            variantId,
            quantity: newData?.quantity,
            mainImageId: Array.isArray(fileIds) ? (fileIds.length > 0 ? fileIds[0] : null) : undefined,
            timestamp,
        })
    );

    if (status !== undefined) {
        statements.push(await buildCompatibilityLineProgressStatement(
            db,
            id,
            status,
            newData?.quantity,
            timestamp
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

    await db.batch(statements);
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
    const updateField = actorType === 'admin' ? 'unread_by_sales' : 'unread_by_admin';
    const inventoryService = resolveInventoryService(db, options);
    const currentOrder = await db
        .prepare('SELECT status, variant_id, quantity FROM orders WHERE id = ?')
        .bind(id)
        .first();
    if (currentOrder?.status) {
        assertOrderStatusTransition(currentOrder.status, newStatus, { forceStatusTransition });
    }
    const stockDelta = getDeliveryStockDelta(currentOrder?.status, newStatus, currentOrder?.quantity);
    const canAdjustVariantStock = Boolean(currentOrder?.variant_id) && stockDelta !== 0;

    if (canAdjustVariantStock && stockDelta < 0) {
        await inventoryService.assertSufficient(currentOrder.variant_id, Math.abs(stockDelta));
    }

    if (canAdjustVariantStock) {
        const orderLineId = await findOrderLineIdByOrderId(db, id);
        await inventoryService.applyMutation({
            type: 'order_shipment',
            variantId: currentOrder.variant_id,
            quantityDelta: stockDelta,
            orderId: id,
            orderLineId,
            referenceType: 'order',
            referenceId: id,
        });
        const lineProgressStatement = await buildCompatibilityLineProgressStatement(
            db,
            id,
            newStatus,
            currentOrder?.quantity,
            timestamp
        );
        const statements = [
            db
                .prepare(
                    `
      UPDATE orders 
      SET status = ?, ${updateField} = 1, updated_at = ? 
      WHERE id = ?
      `
                )
                .bind(newStatus, timestamp, id),
            lineProgressStatement,
        ];
        await db.batch(statements);
        return { success: true, meta: { changes: 1 } };
    }

    const lineProgressStatement = await buildCompatibilityLineProgressStatement(
        db,
        id,
        newStatus,
        currentOrder?.quantity,
        timestamp
    );
    await db.batch([
        db
            .prepare(
                `
      UPDATE orders 
      SET status = ?, ${updateField} = 1, updated_at = ? 
      WHERE id = ?
      `
            )
            .bind(newStatus, timestamp, id),
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

    await db.batch(statements);
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
    const inventoryService = resolveInventoryService(db, options);
    const placeholders = ids.map(() => '?').join(',');
    const { results: existingOrders = [] } = await db
        .prepare(`SELECT id, status, variant_id, quantity FROM orders WHERE id IN (${placeholders})`)
        .bind(...ids)
        .all();
    const orderMap = new Map((existingOrders || []).map((row) => [row.id, row]));
    const deliveryRequirementsByVariant = new Map();

    for (const id of ids) {
        const order = orderMap.get(id);
        if (order?.status) {
            assertOrderStatusTransition(order.status, newStatus, { forceStatusTransition });
        }
        const stockDelta = getDeliveryStockDelta(order?.status, newStatus, order?.quantity);
        if (order?.variant_id && stockDelta < 0) {
            const requiredQty = Math.abs(stockDelta);
            const prev = deliveryRequirementsByVariant.get(order.variant_id) || 0;
            deliveryRequirementsByVariant.set(order.variant_id, prev + requiredQty);
        }
    }
    await assertBatchDeliveryStockSufficient(inventoryService, deliveryRequirementsByVariant);

    const inventoryMutations = [];

    for (const id of ids) {
        const order = orderMap.get(id);
        const stockDelta = getDeliveryStockDelta(order?.status, newStatus, order?.quantity);
        if (order?.variant_id && stockDelta !== 0) {
            inventoryMutations.push({
                type: 'order_shipment',
                variantId: order.variant_id,
                quantityDelta: stockDelta,
                orderId: id,
                referenceType: 'order',
                referenceId: id,
            });
        }

        batchStatements.push(
            db
                .prepare(
                    `
          UPDATE orders SET status = ?, unread_by_sales = 1, updated_at = ? WHERE id = ?
          `
                )
                .bind(newStatus, timestamp, id)
        );
        batchStatements.push(await buildCompatibilityLineProgressStatement(
            db,
            id,
            newStatus,
            order?.quantity,
            timestamp
        ));

        if (timeline) {
            const stmt = timelineRepo.createInsertStatement(id, { ...timeline, orderId: id });
            if (stmt) batchStatements.push(stmt);
        }
    }

    if (inventoryMutations.length > 0) {
        await inventoryService.applyBatch(inventoryMutations);
    }
    await db.batch(batchStatements);
}

/**
 * 标记订单为已读
 * @param {D1Database} db
 * @param {string} id
 * @param {'admin'|'sales'} actorType
 */
export async function markAsRead(db, id, actorType) {
    const field = actorType === 'admin' ? 'unread_by_admin' : 'unread_by_sales';
    await db.prepare(`UPDATE orders SET ${field} = 0 WHERE id = ?`).bind(id).run();
}

/**
 * 设置对方未读标记
 * @param {D1Database} db
 * @param {string} id
 * @param {'admin'|'sales'} actorType
 */
export async function setUnread(db, id, actorType) {
    const targetField = actorType === 'admin' ? 'unread_by_sales' : 'unread_by_admin';
    const timestamp = now();
    await db
        .prepare(`UPDATE orders SET ${targetField} = 1, updated_at = ? WHERE id = ?`)
        .bind(timestamp, id)
        .run();
}

/**
 * 彻底删除订单及其关联数据 (Cascading Delete)
 * @param {D1Database} db
 * @param {string} id
 */
export async function deleteWithRelations(db, id) {
    const statements = [
        db.prepare('DELETE FROM order_timeline WHERE order_id = ?').bind(id),
        db.prepare('DELETE FROM order_files WHERE order_id = ?').bind(id),
        db.prepare('DELETE FROM orders WHERE id = ?').bind(id)
    ];

    await db.batch(statements);
}
