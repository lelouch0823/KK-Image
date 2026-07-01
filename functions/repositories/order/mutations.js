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
import { chunkArray, executeBatchChunks } from '../../lib/db/batch.js';
import { BadRequestError, ConflictError } from '../../lib/hono/errors.js';
import {
  getPrefetchedOrderLineState,
  prefetchOrderLineStates,
} from './line-prefetch.js';
import { createOrderPayloadUpsertStatement, deriveOrderSummaryFields } from './payloads.js';
import { normalizeOrderStatus } from './helpers.js';
import {
  INSUFFICIENT_VARIANT_STOCK_ERROR,
  ORDER_SHIPPED_VOID_GUARD_ERROR,
  ORDER_DELIVERED_COMPLETENESS_ERROR,
  ARCHIVED_ORDER_MUTATION_MESSAGE,
  assertOrderIsActiveForMutation,
  buildPreviousWriteAssertionStatement,
  normalizeGuardedOrderUpdateError,
  verifySingleRowStatusUpdate,
  executeGroupedBatchChunks,
  getUnreadOtherField,
  extractDeadlineDate,
  normalizeQuantity,
  normalizeCreateLine,
  buildCreateLines,
  buildHeaderDataFromLines,
  syncImplicitSingleLineData,
  assertSalesScopedFileIds,
  assertOrderStatusCompatibleWithLines,
  syncCompatibilityOrderLineSnapshot,
  buildCompatibilityLineProgressStatement,
  buildOrderLineInsertStatement,
} from './mutation-helpers.js';

// 重新导出生命周期操作，保持现有 API 不变
export { archive, restore, deleteWithRelations, markAsRead, setUnread } from './mutations-lifecycle.js';

// 重新导出常量，保持现有 API 不变
export { INSUFFICIENT_VARIANT_STOCK_ERROR, ORDER_SHIPPED_VOID_GUARD_ERROR, ORDER_DELIVERED_COMPLETENESS_ERROR };

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
  const primaryLine =
    normalizedLines[0] ||
    normalizeCreateLine({}, { data, quantity, productId, variantId, mainImageId });
  const normalizedQuantity = normalizedLines.reduce(
    (sum, line) => sum + normalizeQuantity(line.quantity),
    0
  );
  const normalizedStatus = normalizeOrderStatus(status || 'pending') || 'pending';
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
    batchStatements.push(
      buildOrderLineInsertStatement(db, {
        orderId: id,
        line,
        status: normalizedStatus,
        mainImageId,
        timestamp,
      })
    );
  });

  batchStatements.push(
    createOrderPayloadUpsertStatement(db, {
      orderId: id,
      originalData: orderData,
      currentData: orderData,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
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
export async function updateData(
  db,
  id,
  newData,
  actorType,
  productId = undefined,
  variantId = undefined
) {
  await assertOrderIsActiveForMutation(db, id);
  const timestamp = now();
  const updateField = getUnreadOtherField(actorType);
  const deadlineDate = extractDeadlineDate(newData);
  const { summaryName, summaryBrand, summarySku } = deriveOrderSummaryFields(newData);

  const params = [
    JSON.stringify(newData),
    timestamp,
    summaryName,
    summaryBrand,
    summarySku,
    deadlineDate,
  ];

  const colsToUpdate = [
    'current_data = ?',
    `${updateField} = 1`,
    'updated_at = ?',
    'summary_name = ?',
    'summary_brand = ?',
    'summary_sku = ?',
    'deadline_date = ?',
  ];

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

  query += ` WHERE id = ? AND archived_at IS NULL`;
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
  try {
    const results = await db.batch([
      updateStmt,
      buildPreviousWriteAssertionStatement(db),
      payloadStmt,
      lineSnapshotStatement,
    ]);
    return results[0];
  } catch (error) {
    normalizeGuardedOrderUpdateError(error);
  }
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
export async function updateComposite(
  db,
  {
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
  }
) {
  await assertOrderIsActiveForMutation(db, id);
  const timestamp = now();
  if (enforceSalesFileScope) {
    await assertSalesScopedFileIds(db, fileIds, salespersonId, { orderId: id });
  }
  const updateField = getUnreadOtherField(actorType);
  const statements = [];
  const normalizedStatus =
    status !== undefined ? normalizeOrderStatus(status) || status : undefined;
  const orderLineStates = await prefetchOrderLineStates(db, [id]);
  const primaryOrderLineState = getPrefetchedOrderLineState(orderLineStates, id);
  const rawLines = Array.isArray(newData?.lines) ? newData.lines.filter(Boolean) : [];
  const hasExplicitLines =
    explicitLineMutation === undefined
      ? rawLines.length > 0
      : Boolean(explicitLineMutation) && rawLines.length > 0;
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
    : syncImplicitSingleLineData(
        newData,
        {
          productId,
          variantId,
          quantity: newData?.quantity,
        },
        primaryOrderLineState
      );
  const effectiveQuantity = hasExplicitLines
    ? normalizedLines.reduce((sum, line) => sum + normalizeQuantity(line.quantity), 0)
    : newData?.quantity;
  const effectiveProductId = hasExplicitLines && normalizedLines.length > 1 ? null : productId;
  const effectiveVariantId = hasExplicitLines && normalizedLines.length > 1 ? null : variantId;

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
  const colsToUpdate = [
    'current_data = ?',
    `${updateField} = 1`,
    'updated_at = ?',
    'summary_name = ?',
    'summary_brand = ?',
    'summary_sku = ?',
    'deadline_date = ?',
  ];
  const params = [
    JSON.stringify(effectiveData),
    timestamp,
    summaryName,
    summaryBrand,
    summarySku,
    deadlineDate,
  ];

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
    db
      .prepare(`UPDATE orders SET ${colsToUpdate.join(', ')} WHERE id = ? AND archived_at IS NULL`)
      .bind(...params)
  );
  statements.push(buildPreviousWriteAssertionStatement(db));

  statements.push(
    createOrderPayloadUpsertStatement(db, {
      orderId: id,
      originalData: JSON.stringify(effectiveData),
      currentData: JSON.stringify(effectiveData),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  );

  if (hasExplicitLines) {
    const lineStatus =
      normalizeOrderStatus(normalizedStatus || effectiveData?.status || 'pending') || 'pending';
    statements.push(db.prepare('DELETE FROM order_lines WHERE order_id = ?').bind(id));
    normalizedLines.forEach((line) => {
      statements.push(
        buildOrderLineInsertStatement(db, {
          orderId: id,
          line,
          status: lineStatus,
          mainImageId: Array.isArray(fileIds)
            ? fileIds.length > 0
              ? fileIds[0]
              : null
            : undefined,
          timestamp,
        })
      );
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
    statements.push(
      await buildCompatibilityLineProgressStatement(
        db,
        id,
        normalizedStatus,
        effectiveQuantity,
        timestamp,
        orderLineStates
      )
    );
  }

  if (Array.isArray(fileIds)) {
    statements.push(db.prepare('DELETE FROM order_files WHERE order_id = ?').bind(id));
    fileIds.forEach((fileId, index) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO order_files (id, order_id, file_id, section, sort_order, added_at)
                     VALUES (?, ?, ?, 'product', ?, ?)`
          )
          .bind(generateId(), id, fileId, index, timestamp)
      );
    });
  }

  try {
    await executeBatchChunks(db, statements);
  } catch (error) {
    normalizeGuardedOrderUpdateError(error);
  }
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
  const normalizedNextStatus = normalizeOrderStatus(newStatus);
  const orderLineStates = await prefetchOrderLineStates(db, [id]);
  await assertOrderStatusCompatibleWithLines(db, id, normalizedNextStatus, orderLineStates);
  const currentOrder = await db
    .prepare('SELECT status, variant_id, quantity, archived_at FROM orders WHERE id = ?')
    .bind(id)
    .first();
  if (!currentOrder?.status) {
    throw new ConflictError('order status was modified concurrently');
  }
  if (currentOrder.archived_at) {
    throw new BadRequestError('订单已归档，请先恢复后再修改');
  }
  if (currentOrder?.status) {
    assertOrderStatusTransition(currentOrder.status, normalizedNextStatus, {
      forceStatusTransition,
    });
  }
  // 注意：库存变更已迁移至行级命令 (lines.js)，此处不再处理 order-level stock delta

  const statusUpdateResult = await db
    .prepare(
      `
      UPDATE orders
      SET status = ?, ${updateField} = 1, updated_at = ?
      WHERE id = ? AND status = ? AND archived_at IS NULL
      `
    )
    .bind(normalizedNextStatus, timestamp, id, currentOrder.status)
    .run();
  if (!(await verifySingleRowStatusUpdate(db, statusUpdateResult))) {
    throw new ConflictError('order status was modified concurrently');
  }

  const lineProgressStatement = await buildCompatibilityLineProgressStatement(
    db,
    id,
    normalizedNextStatus,
    currentOrder?.quantity,
    timestamp,
    orderLineStates
  );
  await executeBatchChunks(db, [lineProgressStatement]);
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
  const statements = [db.prepare(`DELETE FROM order_files WHERE order_id = ?`).bind(orderId)];

  if (fileIds && fileIds.length > 0) {
    fileIds.forEach((fileId, index) => {
      statements.push(
        db
          .prepare(
            `
                    INSERT INTO order_files (id, order_id, file_id, section, sort_order, added_at)
                    VALUES (?, ?, ?, 'product', ?, ?)
                `
          )
          .bind(generateId(), orderId, fileId, index, timestamp)
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
  const statementGroups = [];
  const normalizedNextStatus = normalizeOrderStatus(newStatus);
  const existingOrders = [];
  for (const idChunk of chunkArray(ids)) {
    const placeholders = idChunk.map(() => '?').join(',');
    const { results = [] } = await db
      .prepare(
        `SELECT id, status, variant_id, quantity, archived_at FROM orders WHERE id IN (${placeholders})`
      )
      .bind(...idChunk)
      .all();
    existingOrders.push(...results);
  }
  const archivedOrder = existingOrders.find((row) => row.archived_at);
  if (archivedOrder) {
    throw new BadRequestError('订单已归档，请先恢复后再修改');
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
    const statements = [];
    // 注意：库存变更已迁移至行级命令 (lines.js)，此处不再处理 order-level stock delta

    statements.push(
      db
        .prepare(
          `
          UPDATE orders SET status = ?, unread_by_sales = 1, updated_at = ? WHERE id = ? AND archived_at IS NULL
          `
        )
        .bind(normalizedNextStatus, timestamp, id)
    );
    statements.push(buildPreviousWriteAssertionStatement(db));
    statements.push(
      await buildCompatibilityLineProgressStatement(
        db,
        id,
        normalizedNextStatus,
        order?.quantity,
        timestamp,
        orderLineStates
      )
    );

    if (timeline) {
      const stmt = timelineRepo.createInsertStatement(id, { ...timeline, orderId: id });
      if (stmt) statements.push(stmt);
    }
    statementGroups.push(statements);
  }

  try {
    await executeGroupedBatchChunks(db, statementGroups);
  } catch (error) {
    normalizeGuardedOrderUpdateError(error);
  }
}
