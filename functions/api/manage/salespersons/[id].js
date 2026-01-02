/**
 * 管理端销售人员详情 API
 * GET /api/manage/salespersons/:id - 获取详情
 * PATCH /api/manage/salespersons/:id - 更新销售
 * DELETE /api/manage/salespersons/:id - 删除销售
 * POST /api/manage/salespersons/:id/reset-token - 重置链接
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { SalespersonRepository } from '../../../repositories/SalespersonRepository.js';
import { authenticateAdmin } from '../../utils/auth.js';

/**
 * GET - 获取销售详情
 */
export async function onRequestGet(context) {
  const { env, params, request } = context;
  const { id } = params;

  try {
    await authenticateAdmin(request, env);
    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    // Repository's findById doesn't include order_count currently, need to update repo or fetch separately?
    // Wait, I didn't verify findById includes order_count in my repo implementation.
    // Checking my repo implementation: findById only SELECT * FROM salespersons.
    // I should update findById in Repo to include order_count or fetch it here.
    // Actually, let's keep it simple and just fetch basic info + order count if crucial.
    // In the original code, it fetched order_count.
    // Let's modify Repo findById to include it or just do a separate query inside Repo?
    // I will stick to what the original code did: fetched order_count.
    // My repo findById is simple. I can add HasOrders or just use list for count...

    // Let's use repo.findById and if orderCount is needed, maybe repo.list({limit:1, search:name})? No.
    // I should have added getDetail to Repo.

    // For now, I will assume repo.findById returns basic info.
    // Wait, the original code needed orderCount for the detail view.
    // I will use repo.findById for now and maybe miss orderCount or I can manually fix it later.
    // Actually best is to update Repo to include orderCount in findById?
    // Or just let the UI handle it? The UI likely needs it.

    // Let's rely on repo.findById returning standard fields.
    // If orderCount is missing, I should add it to Repo.findById or use a specialized method.
    // Let's assume for now I will use what I have.

    const salesperson = await repo.findById(id);

    if (!salesperson) {
      return error(MSG.SALESPERSON.NOT_FOUND, 404);
    }

    // Manual count if needed or just omission?
    // Let's add it manually for now to match feature parity efficiently.
    const orderCountResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM orders WHERE salesperson_id = ?'
    )
      .bind(id)
      .first();
    const orderCount = orderCountResult.count;

    return success({
      id: salesperson.id,
      name: salesperson.name,
      store: salesperson.store,
      phone: salesperson.phone,
      accessToken: salesperson.access_token,
      isActive: !!salesperson.is_active,
      orderCount: orderCount,
      createdAt: salesperson.created_at,
      updatedAt: salesperson.updated_at,
    });
  } catch (err) {
    console.error('Salesperson detail error:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

/**
 * PATCH - 更新销售
 */
export async function onRequestPatch(context) {
  const { env, params, request } = context;
  const { id } = params;

  try {
    await authenticateAdmin(request, env);
    const body = await request.json();
    const { name, store, phone, password, isActive } = body;

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const existing = await repo.findById(id);

    if (!existing) {
      return error(MSG.SALESPERSON.NOT_FOUND, 404);
    }

    if (name !== undefined && !name.trim()) {
      return error(MSG.SALESPERSON.NAME_REQUIRED, 400);
    }

    const successResult = await repo.update(id, {
      name: name,
      store: store,
      phone: phone,
      password: password,
      isActive: isActive,
    });

    if (!successResult && Object.keys(body).length === 0) {
      return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
    }

    if (!successResult) {
      // Might be that no fields actually changed or no fields passed
      // But repo.update only returns false if no fields passed.
      return success(null, MSG.SALESPERSON.UPDATE_SUCCESS);
    }

    return success(null, MSG.SALESPERSON.UPDATE_SUCCESS);
  } catch (err) {
    console.error('Salesperson update error:', err);
    return error(`${MSG.COMMON.UPDATE_FAILED}: ${err.message}`, 500);
  }
}

/**
 * DELETE - 删除销售
 */
export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const { id } = params;

  try {
    await authenticateAdmin(request, env);
    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);

    // 检查是否有关联订单
    const hasOrders = await repo.hasOrders(id);
    if (hasOrders) {
      return error(MSG.SALESPERSON.HAS_ORDERS, 400);
    }

    const deleted = await repo.delete(id);
    if (!deleted) {
      return error(MSG.SALESPERSON.NOT_FOUND, 404);
    }

    return success(null, MSG.SALESPERSON.DELETE_SUCCESS);
  } catch (err) {
    console.error('Salesperson delete error:', err);
    return error(`${MSG.COMMON.DELETE_FAILED}: ${err.message}`, 500);
  }
}

/**
 * POST - 重置访问链接
 */
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const { id } = params;
  const url = new URL(request.url);

  // 判断是重置链接操作
  if (url.pathname.endsWith('/reset-token')) {
    try {
      await authenticateAdmin(request, env);
      const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
      const newToken = await repo.resetToken(id);

      return success(
        {
          accessToken: newToken,
          accessUrl: `/order/${newToken}`,
        },
        MSG.SALESPERSON.TOKEN_RESET
      );
    } catch (err) {
      console.error('Salesperson reset token error:', err);
      return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
  }

  return error(MSG.COMMON.INVALID_PARAMS, 400);
}
