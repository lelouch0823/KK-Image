/**
 * 管理端客户订单列表 API
 * GET /api/manage/customers/[id]/orders - 获取客户关联的订单
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const { id } = params;
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');

  try {
    const repo = new OrderRepository(env.DB);

    // Use listForAdmin with customerId filter
    const { items } = await repo.listForAdmin({
      customerId: id,
      limit: limit,
      page: 1, // Fetch first page only as per original API typically
    });

    // Map to match original response structure if necessary
    // Original returned: id, orderNo, productName, status, totalAmount, currency, createdAt, mainImage, salespersonName
    // Repo returns items with camelCase fields which matches mostly.
    // Repo mainImage is '/file/key', original selected 'o.main_image'.
    // Assuming Repo logic is the SOTA one.

    return success(items);
  } catch (err) {
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}
