/**
 * 管理端客户列表 API
 * GET /api/manage/customers - 获取客户列表
 * POST /api/manage/customers - 创建新客户
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateAdmin } from '../../utils/auth.js';
import { CustomerRepository } from '../../../repositories/CustomerRepository.js';

export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    await authenticateAdmin(request, env);

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const repo = new CustomerRepository(env.DB);
    const { results, total, pages } = await repo.list({ page, limit, search });

    return success({
      list: results,
      total,
      page,
      limit,
      totalPages: pages,
    });
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.EXPIRED) {
      return error(err.message, 401);
    }
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const user = await authenticateAdmin(request, env);
    const body = await request.json();
    const {
      name,
      phone = '',
      company = '',
      email = '',
      address = '',
      tags = [],
      remark = '',
    } = body;

    if (!name) {
      return error(MSG.COMMON.INVALID_PARAMS + ': name', 400);
    }

    const repo = new CustomerRepository(env.DB);
    const customer = await repo.create({
      name,
      phone,
      company,
      email,
      address,
      tags,
      remark,
      createdBy: user.name,
    });

    return success({ id: customer.id, name: customer.name }, MSG.COMMON.CREATE_SUCCESS);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.EXPIRED) {
      return error(err.message, 401);
    }
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
