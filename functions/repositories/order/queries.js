/**
 * 订单查询操作 (Order Queries)
 * ============================
 *
 * 封装所有订单相关的 SELECT 查询
 *
 * @module repositories/order/queries
 */

import { parseRepoPagination } from '../../api/utils/pagination.js';
import { expandOrderProcurementStatusFilter } from '../../api/utils/constants.js';
import { mapOrderDetail, mapOrderListItem } from './helpers.js';

const ORDER_LINE_STATUS_AGGREGATE_JOIN = `
      LEFT JOIN (
          SELECT
              aggregate_lines.order_id,
              CASE
                  WHEN aggregate_lines.ordered_qty > 0 AND aggregate_lines.cancelled_qty >= aggregate_lines.ordered_qty THEN 'cancelled'
                  WHEN aggregate_lines.remaining_qty > 0 AND aggregate_lines.shipped_qty >= aggregate_lines.remaining_qty THEN 'completed'
                  WHEN aggregate_lines.shipped_qty > 0 THEN 'partially_shipped'
                  WHEN aggregate_lines.remaining_qty > 0 AND aggregate_lines.received_qty >= aggregate_lines.remaining_qty THEN 'ready'
                  WHEN aggregate_lines.received_qty > 0 THEN 'partially_received'
                  WHEN aggregate_lines.remaining_qty > 0 AND aggregate_lines.procured_qty >= aggregate_lines.remaining_qty THEN 'fully_procured'
                  WHEN aggregate_lines.procured_qty > 0 THEN 'partially_procured'
                  ELSE 'unprocured'
              END AS display_status
          FROM (
              SELECT
                  summarized.order_id,
                  summarized.ordered_qty,
                  summarized.procured_qty,
                  summarized.received_qty,
                  summarized.shipped_qty,
                  summarized.cancelled_qty,
                  MAX(summarized.ordered_qty - summarized.cancelled_qty, 0) AS remaining_qty
              FROM (
                  SELECT
                      order_id,
                      COALESCE(SUM(ordered_qty), 0) AS ordered_qty,
                      COALESCE(SUM(procured_qty), 0) AS procured_qty,
                      COALESCE(SUM(received_qty), 0) AS received_qty,
                      COALESCE(SUM(shipped_qty), 0) AS shipped_qty,
                      COALESCE(SUM(cancelled_qty), 0) AS cancelled_qty
                  FROM order_lines
                  GROUP BY order_id
              ) summarized
          ) aggregate_lines
      ) order_line_agg ON order_line_agg.order_id = o.id
`;

const ORDER_PROGRESS_STATUS_SQL = "COALESCE(order_line_agg.display_status, o.procurement_status, 'none')";

function appendProgressStatusFilter(whereClause, bindParams, procurementStatus) {
    const statusValues = expandOrderProcurementStatusFilter(procurementStatus);
    if (statusValues.length === 0) return whereClause;

    if (statusValues.length === 1) {
        bindParams.push(statusValues[0]);
        return `${whereClause} AND ${ORDER_PROGRESS_STATUS_SQL} = ?`;
    }

    bindParams.push(...statusValues);
    return `${whereClause} AND ${ORDER_PROGRESS_STATUS_SQL} IN (${statusValues.map(() => '?').join(', ')})`;
}

async function findOrderLines(db, orderId) {
    const { results } = await db
        .prepare(
            `
      SELECT
          id, order_id, product_id, variant_id,
          snapshot_name, snapshot_image,
          ordered_qty, procured_qty, received_qty, reserved_qty,
          shipped_qty, cancelled_qty, display_status,
          created_at, updated_at
      FROM order_lines
      WHERE order_id = ?
      ORDER BY created_at ASC
      `
        )
        .bind(orderId)
        .all();

    return results || [];
}

/**
 * 根据 ID 获取订单详情
 * @param {D1Database} db
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findById(db, id) {
    const order = await db
        .prepare(
            `
      SELECT o.*, o.product_id, o.variant_id, o.quantity, f.storage_key as main_image_key, f.blurhash as main_image_blurhash,
             c.name as customer_name, c.company as customer_company, c.phone as customer_phone
      FROM orders o
      LEFT JOIN files f ON o.main_image_id = f.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
      `
        )
        .bind(id)
        .first();

    if (!order) return null;

    const lines = await findOrderLines(db, id);
    return mapOrderDetail({
        ...order,
        lines,
    });
}

/**
 * 根据 ID 和销售员 ID 获取订单（权限校验）
 * @param {D1Database} db
 * @param {string} id
 * @param {string} salespersonId
 * @returns {Promise<Object|null>}
 */
export async function findByIdAndSalesperson(db, id, salespersonId) {
    const order = await db
        .prepare(
            `
      SELECT o.*, o.product_id, o.variant_id, o.quantity, f.storage_key as main_image_key, f.blurhash as main_image_blurhash,
             c.name as customer_name, c.company as customer_company, c.phone as customer_phone
      FROM orders o
      LEFT JOIN files f ON o.main_image_id = f.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ? AND o.salesperson_id = ?
      `
        )
        .bind(id, salespersonId)
        .first();

    if (!order) return null;

    const lines = await findOrderLines(db, id);
    return mapOrderDetail({
        ...order,
        lines,
    });
}

/**
 * 获取超时未处理订单 (状态为 pending 且创建时间早于阈值)
 * @param {D1Database} db
 * @param {number} thresholdTimestamp
 * @returns {Promise<Array<Object>>}
 */
export async function findStalePending(db, thresholdTimestamp) {
    const { results } = await db
        .prepare(
            `
      SELECT o.id, o.order_no, o.salesperson_id, o.status, o.created_at
      FROM orders o
      WHERE o.status = 'pending' AND o.created_at < ?
      `
        )
        .bind(thresholdTimestamp)
        .all();

    return results;
}

/**
 * 销售员订单列表（带 SOTA 多级排序）
 * @param {D1Database} db
 * @param {string} salespersonId
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function listBySalesperson(db, salespersonId, { status, page = 1, limit = 20 } = {}) {
    const { page: safePage, limit: safeLimit, offset } = parseRepoPagination(
        { page, limit },
        { defaultPage: 1, defaultLimit: 20, maxLimit: 100 }
    );

    let where = 'WHERE salesperson_id = ?';
    const params = [salespersonId];

    if (status) {
        where += ' AND status = ?';
        params.push(status);
    }

    const countResult = await db
        .prepare(`SELECT COUNT(*) as total FROM orders ${where}`)
        .bind(...params)
        .first();

    const listSql = `
      SELECT
          o.id, o.order_no, o.current_data, o.status, o.procurement_status,
          order_line_agg.display_status as display_status,
          o.unread_by_sales as is_unread,
          o.main_image_id, o.created_at, o.updated_at,
          f.storage_key as main_image_key, f.blurhash as main_image_blurhash,
          CASE o.status
              WHEN 'pending' THEN 1
              WHEN 'production' THEN 2
              WHEN 'shipping' THEN 3
              WHEN 'confirmed' THEN 4
              WHEN 'arrived' THEN 5
              WHEN 'delivered' THEN 6
              WHEN 'rejected' THEN 7
              WHEN 'void' THEN 99
              ELSE 50
          END as status_priority
      FROM orders o
      ${ORDER_LINE_STATUS_AGGREGATE_JOIN}
      LEFT JOIN files f ON o.main_image_id = f.id
      ${where}
      ORDER BY
          o.unread_by_sales DESC,
          status_priority ASC,
          o.created_at DESC
      LIMIT ? OFFSET ?
      `;

    const { results } = await db
        .prepare(listSql)
        .bind(...params, safeLimit, offset)
        .all();

    return {
        items: results.map(mapOrderListItem),
        total: countResult.total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(countResult.total / safeLimit),
    };
}

/**
 * 管理端订单列表（带筛选和 SOTA 多级排序）
 * @param {D1Database} db
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function listForAdmin(
    db,
    { salespersonId, customerId, status, procurementStatus, search, startTime, endTime, page = 1, limit = 20 } = {}
) {
    const { page: safePage, limit: safeLimit, offset } = parseRepoPagination(
        { page, limit },
        { defaultPage: 1, defaultLimit: 20, maxLimit: 100 }
    );

    let whereClause = '1=1';
    const bindParams = [];

    if (salespersonId) {
        whereClause += ' AND o.salesperson_id = ?';
        bindParams.push(salespersonId);
    }
    if (customerId) {
        whereClause += ' AND o.customer_id = ?';
        bindParams.push(customerId);
    }
    if (status) {
        whereClause += ' AND o.status = ?';
        bindParams.push(status);
    }
    if (procurementStatus) {
        whereClause = appendProgressStatusFilter(whereClause, bindParams, procurementStatus);
    }
    if (startTime > 0) {
        whereClause += ' AND o.created_at >= ?';
        bindParams.push(startTime);
    }
    if (endTime > 0) {
        whereClause += ' AND o.created_at <= ?';
        bindParams.push(endTime);
    }
    if (search) {
        whereClause += ' AND (o.order_no LIKE ? OR o.current_data LIKE ?)';
        const searchPattern = `%${search}%`;
        bindParams.push(searchPattern, searchPattern);
    }

    const countResult = await db
        .prepare(`SELECT COUNT(*) as total FROM orders o ${ORDER_LINE_STATUS_AGGREGATE_JOIN} WHERE ${whereClause}`)
        .bind(...bindParams)
        .first();

    const listSql = `
      SELECT
          o.id, o.order_no, o.salesperson_id, o.current_data, o.status, o.procurement_status, o.product_id, o.variant_id, o.quantity,
          order_line_agg.display_status as display_status,
          o.unread_by_admin as is_unread,
          o.main_image_id, o.created_at, o.updated_at,
          s.name as salesperson_name, s.store as salesperson_store,
          f.storage_key as main_image_key, f.blurhash as main_image_blurhash,
          CASE o.status
              WHEN 'pending' THEN 1
              WHEN 'production' THEN 2
              WHEN 'shipping' THEN 3
              WHEN 'confirmed' THEN 4
              WHEN 'arrived' THEN 5
              WHEN 'delivered' THEN 6
              WHEN 'rejected' THEN 7
              WHEN 'void' THEN 99
              ELSE 50
          END as status_priority
      FROM orders o
      ${ORDER_LINE_STATUS_AGGREGATE_JOIN}
      LEFT JOIN salespersons s ON o.salesperson_id = s.id
      LEFT JOIN files f ON o.main_image_id = f.id
      WHERE ${whereClause}
      ORDER BY
          o.unread_by_admin DESC,
          status_priority ASC,
          o.created_at DESC
      LIMIT ? OFFSET ?
      `;

    const { results } = await db
        .prepare(listSql)
        .bind(...bindParams, safeLimit, offset)
        .all();

    return {
        items: results.map((order) => ({
            ...mapOrderListItem(order),
            salespersonName: order.salesperson_name,
            store: order.salesperson_store,
        })),
        total: countResult.total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(countResult.total / safeLimit),
    };
}

/**
 * 获取订单关联的文件列表
 * @param {D1Database} db
 * @param {string} orderId
 * @returns {Promise<Array>}
 */
export async function getFiles(db, orderId) {
    const result = await db
        .prepare(
            `
      SELECT f.id, f.name, f.original_name, f.mime_type, f.size, f.storage_key, f.blurhash, f.created_at
      FROM order_files of
      JOIN files f ON of.file_id = f.id
      WHERE of.order_id = ?
      ORDER BY of.sort_order ASC, f.created_at ASC
      `
        )
        .bind(orderId)
        .all();

    return result.results.map((f) => ({
        id: f.id,
        filename: f.original_name || f.name,
        mimeType: f.mime_type,
        size: f.size,
        url: `/file/${f.storage_key}`,
        blurhash: f.blurhash,
        createdAt: f.created_at,
    }));
}
