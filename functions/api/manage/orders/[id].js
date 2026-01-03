/**
 * 管理端订单详情 API
 * GET /api/manage/orders/:id - 获取详情
 * PATCH /api/manage/orders/:id - 更新订单（需 reason）
 * PATCH /api/manage/orders/:id/status - 变更状态
 * POST /api/manage/orders/:id/comment - 添加留言
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { verifyJWT, ADMIN_AUTH_COOKIE } from '../../utils/auth.js';
import { parse as parseCookie } from 'cookie';
import { ORDER_STATUSES } from '../../../_shared/utils.js';
import { OrderRepository } from '../../../repositories/OrderRepository.js';
import { OrderTimelineRepository } from '../../../repositories/OrderTimelineRepository.js';

/**
 * 获取当前管理员信息
 */
async function getAdmin(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookie(cookieHeader);
  const jwt = cookies[ADMIN_AUTH_COOKIE];

  if (!jwt) {
    throw new Error(MSG.AUTH.REQUIRED);
  }

  const payload = await verifyJWT(jwt, env);
  return {
    id: payload.sub,
    name: payload.name || 'Admin',
    type: 'admin',
  };
}

/**
 * GET - 获取订单详情
 */
export async function onRequestGet(context) {
  const { env, params, request } = context;
  const { id } = params;

  try {
    await getAdmin(request, env);
    const orderRepo = new OrderRepository(env.DB);

    // 使用 Repository 获取订单详情
    const order = await orderRepo.findById(id);
    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    // 获取销售信息
    const salesperson = await env.DB.prepare(
      `
            SELECT id, name, store, phone FROM salespersons WHERE id = ?
        `
    )
      .bind(order.salespersonId)
      .first();

    // 使用 Repository 获取文件和时间轴
    const timelineRepo = new OrderTimelineRepository(env.DB);
    const [files, timeline] = await Promise.all([
      orderRepo.getFiles(id),
      timelineRepo.getTimeline(id),
    ]);

    // SOTA: Mark as read for Admin upon viewing
    await orderRepo.markAsRead(id, 'admin');

    return success({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      // 确保前端能获取到最新的未读状态 (此时应该是 false)
      isUnread: false,
      hasNewFeedback: order.hasNewFeedback, // Keep legacy for safety
      originalData: order.originalData,
      currentData: order.currentData,
      mainImage: order.mainImage,
      mainImageId: order.mainImageId,
      salesperson: salesperson
        ? {
          id: salesperson.id,
          name: salesperson.name,
          store: salesperson.store,
          phone: salesperson.phone,
        }
        : null,
      files,
      timeline,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  } catch (err) {
    console.error('Order detail error:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

/**
 * PATCH - 更新订单
 */
export async function onRequestPatch(context) {
  const { env, params, request } = context;
  const { id } = params;
  const url = new URL(request.url);

  // 判断是状态变更还是信息修改
  if (url.pathname.endsWith('/status')) {
    return handleStatusChange(context);
  }

  // 信息修改
  try {
    const admin = await getAdmin(request, env);
    const body = await request.json();
    const { updates, reason, fileIds } = body;

    const hasUpdates = updates && Object.keys(updates).length > 0;
    const hasFileIds = fileIds && Array.isArray(fileIds) && fileIds.length > 0;

    if (!hasUpdates && !hasFileIds) {
      return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
    }

    if (!reason || !reason.trim()) {
      return error(MSG.ORDER.REASON_REQUIRED, 400);
    }

    // 获取当前订单
    const order = await env.DB.prepare(
      `
            SELECT id, order_no, current_data FROM orders WHERE id = ?
        `
    )
      .bind(id)
      .first();

    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    const currentData = order.current_data ? JSON.parse(order.current_data) : {};

    // 管理端允许修改的所有字段
    const allowedFields = [
      'name',
      'brand',
      'series',
      'size',
      'color',
      'material',
      'remark',
      'deadline',
    ];

    // 使用共享工具函数处理更新
    const { processOrderUpdate } = await import('../../utils/order-utils.js');
    const result = await processOrderUpdate({
      env,
      orderId: id,
      orderNo: order.order_no,
      currentData,
      updates,
      fileIds: hasFileIds ? fileIds : undefined,
      allowedFields,
      actor: {
        type: 'admin',
        id: admin.id,
        name: admin.name,
      },
      reason: reason.trim(),
    });

    if (!result.hasChanges) {
      return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
    }

    return success(null, MSG.ORDER.UPDATE_SUCCESS);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED) {
      return error(err.message, 401);
    }
    console.error('Order update error:', err);
    return error(`${MSG.COMMON.UPDATE_FAILED}: ${err.message}`, 500);
  }
}

/**
 * 处理状态变更
 */
async function handleStatusChange(context) {
  const { env, params, request } = context;
  const { id } = params;

  try {
    const admin = await getAdmin(request, env);
    const orderRepo = new OrderRepository(env.DB);
    const body = await request.json();
    const { status, note } = body;

    if (!status || !ORDER_STATUSES.includes(status)) {
      return error(MSG.ORDER.INVALID_STATUS, 400);
    }

    // 使用 Repository 获取当前订单
    const order = await orderRepo.findById(id);
    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    if (order.status === status) {
      return error(MSG.ORDER.STATUS_UNCHANGED, 400);
    }

    // 使用 Repository 更新状态
    await orderRepo.updateStatus(id, status, true);

    // 使用 Repository 记录时间轴
    const timelineRepo = new OrderTimelineRepository(env.DB);
    await timelineRepo.addTimelineEntry(id, {
      actionType: 'status_changed',
      actorType: 'admin',
      actorId: admin.id,
      actorName: admin.name,
      oldValue: order.status,
      newValue: status,
      reason: note || null,
    });

    return success(null, MSG.ORDER.STATUS_CHANGED);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED) {
      return error(err.message, 401);
    }
    console.error('Order status change error:', err);
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}

/**
 * POST - 添加留言
 */
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const { id } = params;
  const url = new URL(request.url);

  if (!url.pathname.endsWith('/comment')) {
    return error(MSG.COMMON.INVALID_PARAMS, 400);
  }

  try {
    const admin = await getAdmin(request, env);
    const orderRepo = new OrderRepository(env.DB);
    const body = await request.json();
    const { comment } = body;

    if (!comment || !comment.trim()) {
      return error(MSG.COMMON.INVALID_PARAMS + ': 留言内容不能为空', 400);
    }

    // 验证订单存在
    const order = await orderRepo.findById(id);
    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    // 使用 Repository 添加时间轴记录
    const timelineRepo = new OrderTimelineRepository(env.DB);
    await timelineRepo.addTimelineEntry(id, {
      actionType: 'comment',
      actorType: 'admin',
      actorId: admin.id,
      actorName: admin.name,
      comment: comment.trim(),
    });

    // 设置红点 (通知销售人员)
    await orderRepo.setUnread(id, 'admin');

    return success(null, MSG.ORDER.COMMENT_ADDED);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED) {
      return error(err.message, 401);
    }
    console.error('Order comment error:', err);
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
