/**
 * 销售端订单列表/创建 API
 * GET /api/order/:token/orders - 获取订单列表
 * POST /api/order/:token/orders - 创建新订单
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { generateId, generateOrderNo } from '../../../utils/id.js';
import { ORDER_STATUSES } from '../../../../_shared/utils.js';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';
import { authenticateSalesperson } from '../../../utils/salesperson-auth.js';

/**
 * GET - 获取订单列表
 */
export async function onRequestGet(context) {
  const { env, params, request } = context;
  const accessToken = params.token;

  try {
    const salesperson = await authenticateSalesperson(request, env, accessToken);
    const orderRepo = new OrderRepository(env.DB);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const status = url.searchParams.get('status');

    const result = await orderRepo.listBySalesperson(salesperson.id, {
      status: status && ORDER_STATUSES.includes(status) ? status : null,
      page,
      limit,
    });

    return success({
      orders: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    if (err.message === MSG.SALESPERSON.DISABLED) {
      return error(err.message, 403);
    }
    console.error('Order list error:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

/**
 * POST - 创建新订单
 */
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const accessToken = params.token;

  try {
    const salesperson = await authenticateSalesperson(request, env, accessToken);
    const orderRepo = new OrderRepository(env.DB);
    const body = await request.json();

    const { name, size, color, material, remark, deadline, brand, series, fileIds = [] } = body;

    if (!name) {
      return error(MSG.ORDER.NAME_REQUIRED, 400);
    }

    const orderId = generateId();
    const orderNo = generateOrderNo();

    // 构建订单数据
    const orderData = {
      name: name || '',
      size: size || '',
      color: color || '',
      material: material || '',
      remark: remark || '',
      deadline: deadline || '',
      brand: brand || '',
      series: series || '',
    };

    // 确定主图
    let mainImageId = null;
    if (fileIds.length > 0) {
      // 验证文件存在
      const placeholders = fileIds.map(() => '?').join(',');
      const { results: files } = await env.DB.prepare(
        `
                SELECT id FROM files WHERE id IN (${placeholders})
            `
      )
        .bind(...fileIds)
        .all();

      if (files.length > 0) {
        mainImageId = files[0].id;
      }
    }

    // 使用 Repository 创建订单（原子事务）
    await orderRepo.create({
      id: orderId,
      orderNo,
      salespersonId: salesperson.id,
      data: orderData,
      mainImageId,
      fileIds,
      timeline: {
        actionType: 'created',
        actorType: 'salesperson',
        actorId: salesperson.id,
        actorName: salesperson.name,
      },
    });

    // 面向未来: 自动归档 (非事务，失败不影响订单创建)
    if (fileIds.length > 0) {
      try {
        const { ensureOrderFolder, moveFilesToFolder } =
          await import('../../../utils/folder-utils.js');
        const folderId = await ensureOrderFolder(env, orderNo);
        await moveFilesToFolder(env, fileIds, folderId);
      } catch (e) {
        console.error('File archiving error:', e);
      }
    }

    return success(
      {
        id: orderId,
        orderNo,
      },
      MSG.ORDER.CREATE_SUCCESS,
      201
    );
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    if (err.message === MSG.SALESPERSON.DISABLED) {
      return error(err.message, 403);
    }
    console.error('Order create error:', err);
    return error(`${MSG.COMMON.CREATE_FAILED}: ${err.message}`, 500);
  }
}
