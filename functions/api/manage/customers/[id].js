/**
 * 管理端客户详情 API
 * GET /api/manage/customers/[id] - 获取客户详情
 * PUT /api/manage/customers/[id] - 更新客户信息
 * DELETE /api/manage/customers/[id] - 删除客户
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { CustomerRepository } from '../../../repositories/CustomerRepository.js';

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const { id } = params;

    try {
        const { authenticateAdmin } = await import('../../utils/auth.js');
        await authenticateAdmin(request, env);
        const repo = new CustomerRepository(env.DB);
        const customer = await repo.findById(id);

        if (!customer) {
            return error(MSG.COMMON.NOT_FOUND, 404);
        }

        return success(customer);
    } catch (err) {
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}

export async function onRequestPut(context) {
    const { env, params, request } = context;
    const { id } = params;

    try {
        const { authenticateAdmin } = await import('../../utils/auth.js');
        await authenticateAdmin(request, env);
        const repo = new CustomerRepository(env.DB);
        const existing = await repo.findById(id);

        if (!existing) {
            return error(MSG.COMMON.NOT_FOUND, 404);
        }

        const body = await request.json();
        const { name, phone, company, email, address, tags, remark } = body;

        await repo.update(id, {
            name, phone, company, email, address, tags, remark
        });

        return success({ id }, MSG.COMMON.UPDATE_SUCCESS);

    } catch (err) {
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params, request } = context;
    const { id } = params;

    try {
        const { authenticateAdmin } = await import('../../utils/auth.js');
        await authenticateAdmin(request, env);
        const repo = new CustomerRepository(env.DB);

        // 检查是否有关联订单
        const hasOrders = await repo.hasOrders(id);

        if (hasOrders) {
            return error(MSG.CUSTOMER.CANNOT_DELETE_HAS_ORDERS, 400);
        }

        const deleted = await repo.delete(id);
        if (!deleted) {
            // Maybe not found? But repo.delete returns success if delete executed.
            // If changes=0, it means not found or already deleted.
            // My repo delete returns success && changes > 0.
            // So if !deleted, effectively not found.
            return error(MSG.COMMON.NOT_FOUND, 404);
        }

        return success(null, MSG.COMMON.DELETE_SUCCESS);

    } catch (err) {
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
