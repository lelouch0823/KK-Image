/**
 * 管理端客户订单列表 API
 * GET /api/manage/customers/[id]/orders - 获取客户关联的订单
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const { id } = params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    try {
        const { results } = await env.DB.prepare(`
            SELECT 
                o.id,
                o.order_no as orderNo,
                o.product_name as productName,
                o.status,
                o.total_amount as totalAmount,
                o.currency,
                o.created_at as createdAt,
                o.main_image as mainImage,
                s.name as salespersonName
            FROM orders o
            LEFT JOIN users s ON o.salesperson_id = s.id
            WHERE o.customer_id = ?
            ORDER BY o.created_at DESC
            LIMIT ?
        `).bind(id, limit).all();

        return success(results);

    } catch (err) {
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
