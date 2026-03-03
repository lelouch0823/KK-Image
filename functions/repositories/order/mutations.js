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

export const INSUFFICIENT_VARIANT_STOCK_ERROR = 'insufficient variant stock for delivery';

function getDeliveryStockDelta(oldStatus, newStatus, quantity) {
    const safeQty = Math.max(0, Number(quantity) || 0);
    if (!safeQty) return 0;
    if (oldStatus !== 'delivered' && newStatus === 'delivered') return -safeQty;
    if (oldStatus === 'delivered' && newStatus !== 'delivered') return safeQty;
    return 0;
}

async function getVariantStock(db, variantId) {
    if (!variantId) return 0;
    const row = await db
        .prepare('SELECT stock_quantity FROM product_variants WHERE id = ?')
        .bind(variantId)
        .first();
    return Math.max(0, Number(row?.stock_quantity) || 0);
}

async function assertVariantStockSufficient(db, variantId, requiredQty) {
    const safeRequiredQty = Math.max(0, Number(requiredQty) || 0);
    if (!variantId || safeRequiredQty <= 0) return;
    const stockQty = await getVariantStock(db, variantId);
    if (stockQty < safeRequiredQty) {
        throw new Error(INSUFFICIENT_VARIANT_STOCK_ERROR);
    }
}

async function assertBatchDeliveryStockSufficient(db, requirementsByVariant) {
    for (const [variantId, requiredQty] of requirementsByVariant.entries()) {
        await assertVariantStockSufficient(db, variantId, requiredQty);
    }
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
            .bind(id, orderNo, salespersonId, orderData, orderData, status, mainImageId, quantity, timestamp, timestamp, productId, variantId)
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

    return db
        .prepare(query)
        .bind(...params)
        .run();
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
}) {
    const timestamp = now();
    const updateField = actorType === 'admin' ? 'unread_by_sales' : 'unread_by_admin';
    const statements = [];

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
            await assertVariantStockSufficient(db, currentOrder.variant_id, Math.abs(stockDelta));
        }
        if (currentOrder?.variant_id && stockDelta !== 0) {
            statements.push(
                db
                    .prepare(
                        `UPDATE product_variants
                         SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ?
                         WHERE id = ?`
                    )
                    .bind(stockDelta, timestamp, currentOrder.variant_id)
            );
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
        await assertVariantStockSufficient(db, currentOrder.variant_id, Math.abs(stockDelta));
    }

    if (canAdjustVariantStock) {
        const statements = [
            db
                .prepare(
                    `UPDATE product_variants
                     SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ?
                     WHERE id = ?`
                )
                .bind(stockDelta, timestamp, currentOrder.variant_id),
            db
                .prepare(
                    `
      UPDATE orders 
      SET status = ?, ${updateField} = 1, updated_at = ? 
      WHERE id = ?
      `
                )
                .bind(newStatus, timestamp, id),
        ];
        await db.batch(statements);
        return { success: true, meta: { changes: 1 } };
    }

    return db
        .prepare(
            `
      UPDATE orders 
      SET status = ?, ${updateField} = 1, updated_at = ? 
      WHERE id = ?
      `
        )
        .bind(newStatus, timestamp, id)
        .run();
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
    await assertBatchDeliveryStockSufficient(db, deliveryRequirementsByVariant);

    for (const id of ids) {
        const order = orderMap.get(id);
        const stockDelta = getDeliveryStockDelta(order?.status, newStatus, order?.quantity);
        if (order?.variant_id && stockDelta !== 0) {
            batchStatements.push(
                db
                    .prepare(
                        `UPDATE product_variants
                         SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ?
                         WHERE id = ?`
                    )
                    .bind(stockDelta, timestamp, order.variant_id)
            );
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

        if (timeline) {
            const stmt = timelineRepo.createInsertStatement(id, { ...timeline, orderId: id });
            if (stmt) batchStatements.push(stmt);
        }
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
