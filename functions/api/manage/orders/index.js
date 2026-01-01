/**
 * 管理端订单列表 API
 * GET /api/manage/orders - 获取订单列表
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { ORDER_STATUSES } from '../../../_shared/utils.js';
import { OrderRepository } from '../../../repositories/OrderRepository.js';


/**
 * GET - 获取订单列表
 */
export async function onRequestGet(context) {
    const { env, request } = context;

    try {
        const { authenticateAdmin } = await import('../../utils/auth.js');
        await authenticateAdmin(request, env);
        const orderRepo = new OrderRepository(env.DB);

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const salespersonId = url.searchParams.get('salesperson');
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');
        const startTime = parseInt(url.searchParams.get('startTime') || '0', 10);
        const endTime = parseInt(url.searchParams.get('endTime') || '0', 10);

        // 使用 Repository 查询订单列表
        const result = await orderRepo.listForAdmin({
            salespersonId,
            status: status && ORDER_STATUSES.includes(status) ? status : null,
            search,
            startTime,
            endTime,
            page,
            limit
        });

        // 获取销售列表（用于筛选器）
        const { results: salespersons } = await env.DB.prepare(`
            SELECT id, name, store FROM salespersons WHERE is_active = 1 ORDER BY name
        `).all();

        return success({
            orders: result.items,
            salespersons: salespersons.map(s => ({
                id: s.id,
                name: s.name,
                store: s.store
            })),
            statuses: ORDER_STATUSES,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages
            }
        });

    } catch (err) {
        console.error('Order list error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
