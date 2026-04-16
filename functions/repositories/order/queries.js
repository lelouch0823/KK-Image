/**
 * 订单查询操作 (Order Queries)
 * ============================
 *
 * 封装所有订单相关的 SELECT 查询
 *
 * @module repositories/order/queries
 */

import { parseRepoPagination } from '../../api/utils/pagination.js';
import { expandOrderStatusFilter } from '../../api/utils/constants.js';
import { query, queryFirst } from '../../lib/db/query.js';
import { mapOrderDetail, mapOrderListItem } from './helpers.js';
import { ORDER_PAYLOADS_JOIN_SQL, ORDER_PAYLOADS_SELECT_SQL } from './payloads.js';
import {
    ORDER_SUMMARY_PROJECTION_JOIN,
    appendOrderSummaryDeliveryStatusFilter,
    appendOrderSummaryProductSearchFilter,
    appendOrderSummaryProgressStatusFilter,
} from './summary-projection.js';

async function findOrderLines(db, orderId) {
    const { results } = await query(
        db,
        `
      SELECT
          ol.id, ol.order_id, ol.product_id, ol.variant_id,
          ol.snapshot_name, ol.snapshot_image,
          ol.ordered_qty, ol.procured_qty, ol.received_qty, ol.reserved_qty,
          ol.shipped_qty, COALESCE(orq.returned_qty, 0) AS returned_qty, ol.cancelled_qty, ol.display_status,
          ol.created_at, ol.updated_at
      FROM order_lines ol
      LEFT JOIN (
          SELECT
              order_line_id,
              COALESCE(SUM(quantity), 0) AS returned_qty
          FROM order_returns
          WHERE status != 'cancelled'
          GROUP BY order_line_id
      ) orq ON orq.order_line_id = ol.id
      WHERE ol.order_id = ?
      ORDER BY ol.created_at ASC
      `
        ,
        [orderId],
        { label: 'order.find.lines' }
    );

    return results || [];
}

/**
 * 根据 ID 获取订单详情
 * @param {D1Database} db
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findById(db, id) {
    const order = await queryFirst(
        db,
        `
      SELECT
             o.id, o.order_no, o.salesperson_id, o.customer_id, o.product_id, o.variant_id, o.quantity,
             ${ORDER_PAYLOADS_SELECT_SQL},
             o.status, o.procurement_status, o.fulfillment_status, o.delivery_status,
             o.delivered_at, o.delivered_by, o.delivery_note,
             o.main_image_id, o.unread_by_admin, o.unread_by_sales, o.created_at, o.updated_at,
             f.storage_key as main_image_key, f.blurhash as main_image_blurhash,
             c.name as customer_name, c.company as customer_company, c.phone as customer_phone
      FROM orders o
      ${ORDER_PAYLOADS_JOIN_SQL}
      LEFT JOIN files f ON o.main_image_id = f.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
      `
        ,
        [id],
        { label: 'order.findById' }
    );

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
    const order = await queryFirst(
        db,
        `
      SELECT
             o.id, o.order_no, o.salesperson_id, o.customer_id, o.product_id, o.variant_id, o.quantity,
             ${ORDER_PAYLOADS_SELECT_SQL},
             o.status, o.procurement_status, o.fulfillment_status, o.delivery_status,
             o.delivered_at, o.delivered_by, o.delivery_note,
             o.main_image_id, o.unread_by_admin, o.unread_by_sales, o.created_at, o.updated_at,
             f.storage_key as main_image_key, f.blurhash as main_image_blurhash,
             c.name as customer_name, c.company as customer_company, c.phone as customer_phone
      FROM orders o
      ${ORDER_PAYLOADS_JOIN_SQL}
      LEFT JOIN files f ON o.main_image_id = f.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ? AND o.salesperson_id = ?
      `
        ,
        [id, salespersonId],
        { label: 'order.findByIdAndSalesperson' }
    );

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
    const { results } = await query(
        db,
        `
      SELECT o.id, o.order_no, o.salesperson_id, o.status, o.created_at
      FROM orders o
      WHERE o.status = 'pending' AND o.created_at < ?
      `
        ,
        [thresholdTimestamp],
        { label: 'order.findStalePending' }
    );

    return results;
}

/**
 * 获取临近交期订单（直接使用 sidecar deadline_date）
 * @param {D1Database} db
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<Array<Object>>}
 */
export async function findApproachingDeadline(db, startDate, endDate) {
    const { results } = await query(
        db,
        `
      SELECT o.id, o.order_no, o.salesperson_id, o.deadline_date
      FROM orders o
      WHERE o.status IN ('confirmed', 'in_progress')
        AND o.deadline_date IS NOT NULL
        AND o.deadline_date BETWEEN ? AND ?
      ORDER BY o.deadline_date ASC, o.created_at ASC
      `
        ,
        [startDate, endDate],
        { label: 'order.findApproachingDeadline' }
    );

    return results || [];
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

    let where = 'WHERE o.salesperson_id = ?';
    const params = [salespersonId];

    const statusValues = expandOrderStatusFilter(status);
    if (statusValues.length === 1) {
        where += ' AND o.status = ?';
        params.push(statusValues[0]);
    } else if (statusValues.length > 1) {
        where += ` AND o.status IN (${statusValues.map(() => '?').join(', ')})`;
        params.push(...statusValues);
    }

    const countResult = await queryFirst(
        db,
        `SELECT COUNT(*) as total FROM orders o ${ORDER_SUMMARY_PROJECTION_JOIN} ${where}`,
        params,
        { label: 'order.listBySalesperson.count' }
    );

    const listSql = `
      SELECT
          o.id, o.order_no, o.summary_name, o.summary_brand, o.summary_sku, o.status, o.procurement_status, o.fulfillment_status, o.delivery_status,
          o.product_id, o.variant_id, o.quantity,
          order_summary.display_status as display_status,
          order_summary.ordered_qty as line_ordered_qty,
          order_summary.shipped_qty as line_shipped_qty,
          order_summary.returned_qty as line_returned_qty,
          order_summary.cancelled_qty as line_cancelled_qty,
          order_summary.snapshot_name as snapshot_name,
          o.unread_by_sales as is_unread,
          o.main_image_id, o.created_at, o.updated_at,
          f.storage_key as main_image_key, f.blurhash as main_image_blurhash,
          CASE o.status
              WHEN 'pending' THEN 1
              WHEN 'production' THEN 2
              WHEN 'shipping' THEN 3
              WHEN 'confirmed' THEN 4
              WHEN 'arrived' THEN 5
              WHEN 'fulfilled' THEN 6
              WHEN 'delivered' THEN 6
              WHEN 'rejected' THEN 7
              WHEN 'void' THEN 99
              ELSE 50
          END as status_priority
      FROM orders o
      ${ORDER_SUMMARY_PROJECTION_JOIN}
      LEFT JOIN files f ON o.main_image_id = f.id
      ${where}
      ORDER BY
          o.unread_by_sales DESC,
          status_priority ASC,
          o.created_at DESC
      LIMIT ? OFFSET ?
      `;

    const { results } = await query(
        db,
        listSql,
        [...params, safeLimit, offset],
        { label: 'order.listBySalesperson.list' }
    );

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
    { salespersonId, customerId, status, procurementStatus, deliveryStatus, search, startTime, endTime, page = 1, limit = 20 } = {}
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
    const statusValues = expandOrderStatusFilter(status);
    if (statusValues.length === 1) {
        whereClause += ' AND o.status = ?';
        bindParams.push(statusValues[0]);
    } else if (statusValues.length > 1) {
        whereClause += ` AND o.status IN (${statusValues.map(() => '?').join(', ')})`;
        bindParams.push(...statusValues);
    }
    if (procurementStatus) {
        whereClause = appendOrderSummaryProgressStatusFilter(whereClause, bindParams, procurementStatus);
    }
    if (deliveryStatus) {
        whereClause = appendOrderSummaryDeliveryStatusFilter(whereClause, bindParams, deliveryStatus);
    }
    if (startTime > 0) {
        whereClause += ' AND o.created_at >= ?';
        bindParams.push(startTime);
    }
    if (endTime > 0) {
        whereClause += ' AND o.created_at <= ?';
        bindParams.push(endTime);
    }
    whereClause = appendOrderSummaryProductSearchFilter(whereClause, bindParams, search);

    const countResult = await queryFirst(
        db,
        `SELECT COUNT(*) as total FROM orders o ${ORDER_SUMMARY_PROJECTION_JOIN} WHERE ${whereClause}`,
        bindParams,
        { label: 'order.listForAdmin.count' }
    );

    const listSql = `
      SELECT
          o.id, o.order_no, o.salesperson_id, o.summary_name, o.summary_brand, o.summary_sku, o.status, o.procurement_status, o.fulfillment_status, o.delivery_status, o.product_id, o.variant_id, o.quantity,
          order_summary.display_status as display_status,
          order_summary.ordered_qty as line_ordered_qty,
          order_summary.shipped_qty as line_shipped_qty,
          order_summary.returned_qty as line_returned_qty,
          order_summary.cancelled_qty as line_cancelled_qty,
          order_summary.snapshot_name as snapshot_name,
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
              WHEN 'fulfilled' THEN 6
              WHEN 'delivered' THEN 6
              WHEN 'rejected' THEN 7
              WHEN 'void' THEN 99
              ELSE 50
          END as status_priority
      FROM orders o
      ${ORDER_SUMMARY_PROJECTION_JOIN}
      LEFT JOIN salespersons s ON o.salesperson_id = s.id
      LEFT JOIN files f ON o.main_image_id = f.id
      WHERE ${whereClause}
      ORDER BY
          o.unread_by_admin DESC,
          status_priority ASC,
          o.created_at DESC
      LIMIT ? OFFSET ?
      `;

    const { results } = await query(
        db,
        listSql,
        [...bindParams, safeLimit, offset],
        { label: 'order.listForAdmin.list' }
    );

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
    const result = await query(
        db,
        `
      SELECT f.id, f.name, f.original_name, f.mime_type, f.size, f.storage_key, f.blurhash, f.created_at
      FROM order_files of
      JOIN files f ON of.file_id = f.id
      WHERE of.order_id = ?
      ORDER BY of.sort_order ASC, f.created_at ASC
      `
        ,
        [orderId],
        { label: 'order.files.list' }
    );

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
