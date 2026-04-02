/**
 * 订单数据映射工具 (Order Helpers)
 * ================================
 *
 * 提供订单数据解析和映射的辅助函数
 *
 * @module repositories/order/helpers
 */

import { parseJsonObject } from '../../api/utils/json.js';
import { projectOrderLineStatus } from '../../services/OrderStatusProjectionService.js';

export function mapOrderLine(line) {
    return {
        id: line.id,
        orderId: line.order_id,
        productId: line.product_id,
        variantId: line.variant_id,
        snapshotName: line.snapshot_name || '',
        snapshotImage: line.snapshot_image || null,
        orderedQuantity: Number(line.ordered_qty || 0),
        procuredQuantity: Number(line.procured_qty || 0),
        receivedQuantity: Number(line.received_qty || 0),
        reservedQuantity: Number(line.reserved_qty || 0),
        shippedQuantity: Number(line.shipped_qty || 0),
        cancelledQuantity: Number(line.cancelled_qty || 0),
        displayStatus: line.display_status || 'unprocured',
        createdAt: line.created_at,
        updatedAt: line.updated_at,
    };
}

export function aggregateOrderDisplayStatus(lines = []) {
    if (!Array.isArray(lines) || lines.length === 0) return null;

    return projectOrderLineStatus(lines.reduce((acc, line) => ({
        ordered_qty: acc.ordered_qty + Number(line?.ordered_qty ?? line?.orderedQuantity ?? 0),
        procured_qty: acc.procured_qty + Number(line?.procured_qty ?? line?.procuredQuantity ?? 0),
        received_qty: acc.received_qty + Number(line?.received_qty ?? line?.receivedQuantity ?? 0),
        reserved_qty: acc.reserved_qty + Number(line?.reserved_qty ?? line?.reservedQuantity ?? 0),
        shipped_qty: acc.shipped_qty + Number(line?.shipped_qty ?? line?.shippedQuantity ?? 0),
        cancelled_qty: acc.cancelled_qty + Number(line?.cancelled_qty ?? line?.cancelledQuantity ?? 0),
    }), {
        ordered_qty: 0,
        procured_qty: 0,
        received_qty: 0,
        reserved_qty: 0,
        shipped_qty: 0,
        cancelled_qty: 0,
    }));
}

/**
 * 映射订单列表项（简化视图）
 * @param {Object} order - 数据库订单记录
 * @returns {Object} 格式化的列表项
 */
export function mapOrderListItem(order) {
    const currentData = parseJsonObject(order.current_data, {});
    const procurementStatus = order.procurement_status || 'none';
    const displayStatus = order.display_status || procurementStatus;
    return {
        id: order.id,
        orderNo: order.order_no,
        productName: currentData.name || '',
        status: order.status,
        procurementStatus,
        displayStatus,
        hasNewFeedback: !!order.is_unread,
        mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
        mainImageBlurhash: order.main_image_blurhash,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        productId: order.product_id,
        variantId: order.variant_id,
        quantity: order.quantity || 1,
    };
}

/**
 * 映射订单详情（完整视图）
 * @param {Object} order - 数据库订单记录
 * @returns {Object} 格式化的详情对象
 */
export function mapOrderDetail(order) {
    const originalData = parseJsonObject(order.original_data, {});
    const currentData = parseJsonObject(order.current_data, {});
    const procurementStatus = order.procurement_status || 'none';
    const lines = Array.isArray(order.lines) ? order.lines.map(mapOrderLine) : [];
    const displayStatus = order.display_status || aggregateOrderDisplayStatus(lines) || procurementStatus;

    return {
        id: order.id,
        orderNo: order.order_no,
        salespersonId: order.salesperson_id,
        customerId: order.customer_id,
        productId: order.product_id,
        variantId: order.variant_id,
        customer: order.customer_name
            ? {
                name: order.customer_name,
                company: order.customer_company,
                phone: order.customer_phone,
            }
            : null,
        status: order.status,
        procurementStatus,
        displayStatus,
        unreadByAdmin: !!order.unread_by_admin,
        unreadBySales: !!order.unread_by_sales,
        originalData,
        currentData,
        lines,
        mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
        mainImageBlurhash: order.main_image_blurhash,
        mainImageId: order.main_image_id,
        quantity: order.quantity || 1,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
    };
}
