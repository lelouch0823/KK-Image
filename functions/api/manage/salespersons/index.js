/**
 * 管理端销售人员 API
 * GET /api/manage/salespersons - 获取销售列表
 * POST /api/manage/salespersons - 创建销售
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateAdmin } from '../../utils/auth.js';
import { SalespersonRepository } from '../../../repositories/SalespersonRepository.js';

/**
 * GET - 获取销售列表
 */
export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    await authenticateAdmin(request, env);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const search = url.searchParams.get('search') || '';

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const { results, total, pages } = await repo.list({ page, limit, search });

    return success({
      salespersons: results.map((s) => ({
        id: s.id,
        name: s.name,
        store: s.store,
        phone: s.phone,
        accessToken: s.access_token,
        isActive: !!s.is_active,
        orderCount: s.order_count,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: pages,
      },
    });
  } catch (err) {
    console.error('Salesperson list error:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

/**
 * POST - 创建销售
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    await authenticateAdmin(request, env);
    const body = await request.json();
    const { name, store, phone, password } = body;

    if (!name || !name.trim()) {
      return error(MSG.SALESPERSON.NAME_REQUIRED, 400);
    }

    if (!password) {
      return error(MSG.SALESPERSON.PASSWORD_REQUIRED, 400);
    }

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    const salesperson = await repo.create({
      name: name.trim(),
      store: store || null,
      phone: phone || null,
      password,
    });

    return success(salesperson, MSG.SALESPERSON.CREATE_SUCCESS, 201);
  } catch (err) {
    console.error('Salesperson create error:', err);
    return error(`${MSG.COMMON.CREATE_FAILED}: ${err.message}`, 500);
  }
}
