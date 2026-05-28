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

function normalizeOrderStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'delivered') return 'fulfilled';
    return normalized || 'pending';
}

function normalizeExplicitFulfillmentStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['unfulfilled', 'partially_fulfilled', 'fulfilled'].includes(normalized)) return normalized;
    return '';
}

function normalizeExplicitDeliveryStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['not_shipped', 'in_transit', 'delivered', 'partially_returned', 'returned'].includes(normalized)) return normalized;
    return '';
}

function mapDeliveryConfirmation(order = {}) {
    return {
        deliveryConfirmedAt: order?.delivered_at || null,
        deliveryConfirmedBy: order?.delivered_by || '',
        deliveryNote: order?.delivery_note || '',
    };
}

function mapOrderLine(line) {
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
        returnedQuantity: Number(line.returned_qty || 0),
        cancelledQuantity: Number(line.cancelled_qty || 0),
        displayStatus: line.display_status || 'unprocured',
        createdAt: line.created_at,
        updatedAt: line.updated_at,
    };
}

function toNonNegativeNumber(value, fallback = 0) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized < 0) return fallback;
    return normalized;
}

function normalizeSnapshotText(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
}

function mapFallbackOrderLine(line = {}, order = {}, index = 0, fallbackStatus = 'none') {
    return {
        id: line.id || `${order.id || order.order_no || 'order'}-compat-line-${index + 1}`,
        orderId: order.id || null,
        productId: line.productId ?? line.product_id ?? order.product_id ?? null,
        variantId: line.variantId ?? line.variant_id ?? order.variant_id ?? null,
        snapshotName: normalizeSnapshotText(
            line.snapshotName ?? line.snapshot_name ?? line.name ?? line.productName,
            ''
        ),
        snapshotImage: line.snapshotImage ?? line.snapshot_image ?? null,
        orderedQuantity: toNonNegativeNumber(line.orderedQuantity ?? line.ordered_qty ?? line.quantity, 0),
        procuredQuantity: toNonNegativeNumber(line.procuredQuantity ?? line.procured_qty, 0),
        receivedQuantity: toNonNegativeNumber(line.receivedQuantity ?? line.received_qty, 0),
        reservedQuantity: toNonNegativeNumber(line.reservedQuantity ?? line.reserved_qty, 0),
        shippedQuantity: toNonNegativeNumber(line.shippedQuantity ?? line.shipped_qty, 0),
        returnedQuantity: toNonNegativeNumber(line.returnedQuantity ?? line.returned_qty, 0),
        cancelledQuantity: toNonNegativeNumber(line.cancelledQuantity ?? line.cancelled_qty, 0),
        displayStatus: line.displayStatus || line.display_status || fallbackStatus,
        createdAt: order.created_at || null,
        updatedAt: order.updated_at || null,
    };
}

function buildFallbackOrderLines(order = {}, currentData = {}, originalData = {}, fallbackStatus = 'none') {
    const rawLines = Array.isArray(currentData?.lines) && currentData.lines.length > 0
        ? currentData.lines
        : (Array.isArray(originalData?.lines) && originalData.lines.length > 0 ? originalData.lines : []);

    if (rawLines.length > 0) {
        return rawLines
            .filter(Boolean)
            .map((line, index) => mapFallbackOrderLine(line, order, index, fallbackStatus));
    }

    const snapshotName = normalizeSnapshotText(
        currentData?.name ?? originalData?.name,
        ''
    );

    if (!snapshotName && !order?.product_id && !order?.variant_id && !(Number(order?.quantity) > 0)) {
        return [];
    }

    return [
        mapFallbackOrderLine({
            name: snapshotName,
            quantity: order?.quantity ?? currentData?.quantity ?? originalData?.quantity ?? 1,
            productId: order?.product_id ?? null,
            variantId: order?.variant_id ?? null,
        }, order, 0, fallbackStatus),
    ];
}

function aggregateOrderDisplayStatus(lines = []) {
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

function deriveListItemDeliverability(order) {
    const orderedQty = Number(order?.line_ordered_qty ?? 0);
    const shippedQty = Number(order?.line_shipped_qty ?? 0);
    const cancelledQty = Number(order?.line_cancelled_qty ?? 0);
    const remainingQty = Math.max(orderedQty - cancelledQty, 0);
    return shippedQty >= remainingQty;
}

function deriveFulfillmentStatus({ orderedQty = 0, shippedQty = 0, cancelledQty = 0 } = {}) {
    const ordered = Math.max(0, Number(orderedQty) || 0);
    const shipped = Math.max(0, Number(shippedQty) || 0);
    const cancelled = Math.max(0, Number(cancelledQty) || 0);
    const remainingQty = Math.max(ordered - cancelled, 0);

    if (remainingQty > 0 && shipped >= remainingQty) return 'fulfilled';
    if (shipped > 0) return 'partially_fulfilled';
    return 'unfulfilled';
}

function deriveDeliveryStatus(order, fulfillmentStatus, { shippedQty = 0, returnedQty = 0 } = {}) {
    const shipped = Math.max(0, Number(shippedQty) || 0);
    const returned = Math.max(0, Number(returnedQty) || 0);
    const explicitStatus = normalizeExplicitDeliveryStatus(order?.delivery_status);
    if (shipped > 0 && returned > 0) {
        if (returned >= shipped) return 'returned';
        return 'partially_returned';
    }
    if (explicitStatus) return explicitStatus;
    if (Number(order?.delivered_at || 0) > 0) return 'delivered';
    if (fulfillmentStatus === 'fulfilled') return 'in_transit';
    if (fulfillmentStatus === 'partially_fulfilled') return 'in_transit';
    return 'not_shipped';
}

function hasListFulfillmentFacts(order) {
    return [
        order?.line_ordered_qty,
        order?.line_shipped_qty,
        order?.line_cancelled_qty,
    ].some((value) => value !== undefined && value !== null);
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
    const canFulfillComplete = deriveListItemDeliverability(order);
    const derivedFulfillmentStatus = deriveFulfillmentStatus({
        orderedQty: order?.line_ordered_qty,
        shippedQty: order?.line_shipped_qty,
        cancelledQty: order?.line_cancelled_qty,
    });
    const explicitFulfillmentStatus = normalizeExplicitFulfillmentStatus(order?.fulfillment_status);
    const fulfillmentStatus = hasListFulfillmentFacts(order)
        ? derivedFulfillmentStatus
        : (explicitFulfillmentStatus || derivedFulfillmentStatus);
    const deliveryStatus = deriveDeliveryStatus(order, fulfillmentStatus, {
        shippedQty: order?.line_shipped_qty,
        returnedQty: order?.line_returned_qty,
    });
    return {
        id: order.id,
        orderNo: order.order_no,
        productName: order.summary_name || currentData.name || order.snapshot_name || '',
        brand: order.summary_brand || currentData.brand || '',
        sku: order.summary_sku || currentData.sku || currentData.variant_sku || currentData.spu || '',
        status: normalizeOrderStatus(order.status),
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
        canDeliver: canFulfillComplete,
        canFulfillComplete,
        fulfillmentStatus,
        deliveryStatus,
        ...mapDeliveryConfirmation(order),
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
    const persistedLines = Array.isArray(order.lines) ? order.lines.map(mapOrderLine) : [];
    const lines = persistedLines.length > 0
        ? persistedLines
        : buildFallbackOrderLines(order, currentData, originalData, order.display_status || procurementStatus);
    const displayStatus = order.display_status || aggregateOrderDisplayStatus(persistedLines) || procurementStatus;
    const rolledUpLineTotals = persistedLines.reduce((acc, line) => ({
        orderedQty: acc.orderedQty + Number(line?.orderedQuantity || 0),
        shippedQty: acc.shippedQty + Number(line?.shippedQuantity || 0),
        returnedQty: acc.returnedQty + Number(line?.returnedQuantity || 0),
        cancelledQty: acc.cancelledQty + Number(line?.cancelledQuantity || 0),
    }), {
        orderedQty: 0,
        shippedQty: 0,
        returnedQty: 0,
        cancelledQty: 0,
    });
    const derivedFulfillmentStatus = deriveFulfillmentStatus(rolledUpLineTotals);
    const explicitFulfillmentStatus = normalizeExplicitFulfillmentStatus(order?.fulfillment_status);
    const fulfillmentStatus = persistedLines.length > 0
        ? derivedFulfillmentStatus
        : (explicitFulfillmentStatus || derivedFulfillmentStatus);
    const deliveryStatus = deriveDeliveryStatus(order, fulfillmentStatus, rolledUpLineTotals);

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
        status: normalizeOrderStatus(order.status),
        procurementStatus,
        displayStatus,
        fulfillmentStatus,
        deliveryStatus,
        ...mapDeliveryConfirmation(order),
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
