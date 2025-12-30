/**
 * 管理端订单列表 API
 * GET /api/manage/orders - 获取订单列表
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { verifyJWT } from '../../utils/auth.js';
import { ORDER_STATUSES } from '../../../_shared/utils.js';


/**
 * GET - 获取订单列表
 */
export async function onRequestGet(context) {
    const { env, request } = context;

    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const salespersonId = url.searchParams.get('salesperson');
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');
        const offset = (page - 1) * limit;

        // 构建查询
        let whereClause = '1=1';
        const bindParams = [];

        if (salespersonId) {
            whereClause += ' AND o.salesperson_id = ?';
            bindParams.push(salespersonId);
        }

        if (status && ORDER_STATUSES.includes(status)) {
            whereClause += ' AND o.status = ?';
            bindParams.push(status);
        }

        if (search) {
            whereClause += ' AND (o.order_no LIKE ? OR o.current_data LIKE ?)';
            const searchPattern = `%${search}%`;
            bindParams.push(searchPattern, searchPattern);
        }

        // 获取总数
        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}
        `).bind(...bindParams).first();

        // 获取订单列表
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.id, o.order_no, o.salesperson_id, o.current_data, o.status, 
                o.has_new_feedback, o.main_image_id, o.created_at, o.updated_at,
                s.name as salesperson_name, s.store as salesperson_store,
                f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN salespersons s ON o.salesperson_id = s.id
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `).bind(...bindParams, limit, offset).all();

        // 格式化返回
        const formattedOrders = orders.map(order => {
            const currentData = order.current_data ? JSON.parse(order.current_data) : {};
            return {
                id: order.id,
                orderNo: order.order_no,
                productName: currentData.name || '',
                status: order.status,
                hasNewFeedback: !!order.has_new_feedback,
                mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
                salesperson: {
                    id: order.salesperson_id,
                    name: order.salesperson_name,
                    store: order.salesperson_store
                },
                createdAt: order.created_at,
                updatedAt: order.updated_at
            };
        });

        // 获取销售列表（用于筛选器）
        const { results: salespersons } = await env.DB.prepare(`
            SELECT id, name, store FROM salespersons WHERE is_active = 1 ORDER BY name
        `).all();

        return success({
            orders: formattedOrders,
            salespersons: salespersons.map(s => ({
                id: s.id,
                name: s.name,
                store: s.store
            })),
            statuses: ORDER_STATUSES,
            pagination: {
                page,
                limit,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / limit)
            }
        });

    } catch (err) {
        console.error('Order list error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
