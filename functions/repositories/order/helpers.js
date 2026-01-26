/**
 * 订单数据映射工具 (Order Helpers)
 * ================================
 *
 * 提供订单数据解析和映射的辅助函数
 *
 * @module repositories/order/helpers
 */

/**
 * 安全解析 JSON 字符串
 * @param {string|null} jsonStr - JSON 字符串
 * @returns {Object} 解析后的对象，失败返回空对象
 */
export function parseJson(jsonStr) {
    try {
        return jsonStr ? JSON.parse(jsonStr) : {};
    } catch (e) {
        console.warn('JSON parse failed:', e);
        return {};
    }
}

/**
 * 映射订单列表项（简化视图）
 * @param {Object} order - 数据库订单记录
 * @returns {Object} 格式化的列表项
 */
export function mapOrderListItem(order) {
    const currentData = parseJson(order.current_data);
    return {
        id: order.id,
        orderNo: order.order_no,
        productName: currentData.name || '',
        status: order.status,
        hasNewFeedback: !!order.is_unread,
        mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
        mainImageBlurhash: order.main_image_blurhash,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        productId: order.product_id,
        quantity: order.quantity || 1,
    };
}

/**
 * 映射订单详情（完整视图）
 * @param {Object} order - 数据库订单记录
 * @returns {Object} 格式化的详情对象
 */
export function mapOrderDetail(order) {
    const originalData = parseJson(order.original_data);
    const currentData = parseJson(order.current_data);

    return {
        id: order.id,
        orderNo: order.order_no,
        salespersonId: order.salesperson_id,
        customerId: order.customer_id,
        productId: order.product_id,
        customer: order.customer_name
            ? {
                name: order.customer_name,
                company: order.customer_company,
                phone: order.customer_phone,
            }
            : null,
        status: order.status,
        unreadByAdmin: !!order.unread_by_admin,
        unreadBySales: !!order.unread_by_sales,
        originalData,
        currentData,
        mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
        mainImageBlurhash: order.main_image_blurhash,
        mainImageId: order.main_image_id,
        quantity: order.quantity || 1,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
    };
}
