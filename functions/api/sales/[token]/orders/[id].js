/**
 * 销售端订单详情 API
 * GET /api/order/:token/orders/:id - 获取订单详情
 * POST /api/order/:token/orders/:id/comment - 添加留言
 * PATCH /api/order/:token/orders/:id/read - 清除红点
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { now } from '../../../utils/id.js';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';
import { OrderTimelineRepository } from '../../../../repositories/OrderTimelineRepository.js';
import { authenticateSalesperson } from '../../../utils/salesperson-auth.js';
import { createOrderNotification } from '../../../utils/order-utils.js';

/**
 * 记录时间轴
 */
async function logTimeline(db, params) {
  const timelineRepo = new OrderTimelineRepository(db);
  await timelineRepo.addTimelineEntry(params.orderId, params);
}

/**
 * GET - 获取订单详情
 */
export async function onRequestGet(context) {
  const { env, params, request } = context;
  const { token: accessToken, id: orderId } = params;

  try {
    const salesperson = await authenticateSalesperson(request, env, accessToken);
    const orderRepo = new OrderRepository(env.DB);

    // 使用 Repository 获取订单详情
    const order = await orderRepo.findByIdAndSalesperson(orderId, salesperson.id);

    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    // 使用 Repository 获取文件和时间轴
    const timelineRepo = new OrderTimelineRepository(env.DB);
    const [files, timeline] = await Promise.all([
      orderRepo.getFiles(orderId),
      timelineRepo.getTimeline(orderId),
    ]);

    // SOTA: Mark as read for Sales
    await orderRepo.markAsRead(orderId, 'sales');

    return success({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      hasNewFeedback: order.hasNewFeedback,
      originalData: order.originalData,
      currentData: order.currentData,
      mainImage: order.mainImage,
      mainImageId: order.mainImageId,
      files,
      timeline,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    console.error('Order detail error:', err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

/**
 * PATCH - 更新订单 (销售端)
 */
export async function onRequestPatch(context) {
  const { env, params, request } = context;
  const { token: accessToken, id: orderId } = params;
  const url = new URL(request.url);

  // 清除红点接口
  if (url.pathname.endsWith('/read')) {
    return handleMarkRead(context);
  }

  try {
    const salesperson = await authenticateSalesperson(request, env, accessToken);
    const body = await request.json();

    // 销售端：分离 fileIds、reason 和 updates
    const { fileIds, reason, ...updates } = body.updates || body;

    const hasUpdates = updates && Object.keys(updates).length > 0;
    const hasFileIds = fileIds && Array.isArray(fileIds);

    if (!hasUpdates && !hasFileIds) {
      return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
    }

    // 销售端也要求填写修改理由
    if (!reason || !reason.trim()) {
      return error(MSG.ORDER.REASON_REQUIRED, 400);
    }

    // 获取订单
    const order = await env.DB.prepare(
      `
            SELECT id, order_no, current_data, status FROM orders WHERE id = ? AND salesperson_id = ?
        `
    )
      .bind(orderId, salesperson.id)
      .first();

    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    const editableStatuses = ['pending', 'rejected', 'void'];
    if (!editableStatuses.includes(order.status)) {
      return error(MSG.ORDER.ONLY_PENDING_CAN_EDIT, 403);
    }

    const shouldResetStatus = ['rejected', 'void'].includes(order.status);
    const currentData = order.current_data ? JSON.parse(order.current_data) : {};

    // 允许销售端修改的字段
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
    const { processOrderUpdate } = await import('../../../utils/order-utils.js');
    const result = await processOrderUpdate({
      env,
      orderId,
      orderNo: order.order_no,
      currentData,
      updates,
      fileIds: hasFileIds ? fileIds : undefined,
      allowedFields,
      actor: {
        type: 'salesperson',
        id: salesperson.id,
        name: salesperson.name,
      },
      reason: reason.trim(),
    });

    if (!result.hasChanges) {
      return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
    }

    // 如果从 rejected/void 变为 pending，更新状态并记录
    if (shouldResetStatus) {
      const orderRepo = new OrderRepository(env.DB);
      await orderRepo.updateStatus(orderId, 'pending', 'sales');

      await logTimeline(env.DB, {
        orderId,
        actionType: 'status_changed',
        actorType: 'salesperson',
        actorId: salesperson.id,
        actorName: salesperson.name,
        oldValue: order.status,
        newValue: 'pending',
        reason: MSG.ORDER.REASON_RESUBMIT,
      });
    }

    // SOTA: 创建通知 -> 通知管理端
    try {
      await createOrderNotification(env.DB, {
        event: 'ORDER_UPDATED_BY_SALES',
        orderId,
        orderNo: order.order_no,
        receiver: 'admin',
        actorName: salesperson.name,
      });
    } catch (e) {
      console.error('Notification creation error:', e);
    }

    return success(null, MSG.ORDER.UPDATE_SUCCESS);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    console.error('Order update error:', err);
    return error(`${MSG.COMMON.UPDATE_FAILED}: ${err.message}`, 500);
  }
}

/**
 * DELETE - 作废订单
 */
export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const { token: accessToken, id: orderId } = params;

  try {
    const salesperson = await authenticateSalesperson(request, env, accessToken);

    const order = await env.DB.prepare(
      `
            SELECT id, status FROM orders WHERE id = ? AND salesperson_id = ?
        `
    )
      .bind(orderId, salesperson.id)
      .first();

    if (!order) {
      return error(MSG.ORDER.NOT_FOUND, 404);
    }

    if (order.status !== 'pending') {
      return error(MSG.ORDER.ONLY_PENDING_CAN_VOID, 403);
    }

    // 软删除 -> void
    await env.DB.prepare(
      `
            UPDATE orders SET status = 'void', updated_at = ? WHERE id = ?
        `
    )
      .bind(now(), orderId)
      .run();

    await logTimeline(env.DB, {
      orderId,
      actionType: 'status_changed',
      actorType: 'salesperson',
      actorId: salesperson.id,
      actorName: salesperson.name,
      oldValue: order.status,
      newValue: 'void',
      reason: MSG.ORDER.REASON_SALES_VOID,
    });

    return success(null, MSG.ORDER.VOID_SUCCESS);
  } catch (err) {
    if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
      return error(err.message, 401);
    }
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}

async function handleMarkRead(context) {
  const { env, params, request } = context;
  const { token: accessToken, id: orderId } = params;

  try {
    const salesperson = await authenticateSalesperson(request, env, accessToken);
    const OrderRepository = (await import('../../../../repositories/OrderRepository.js')).OrderRepository;
    const orderRepo = new OrderRepository(env.DB);

    // 验证订单归属
    const order = await env.DB.prepare('SELECT id FROM orders WHERE id = ? AND salesperson_id = ?')
      .bind(orderId, salesperson.id)
      .first();

    if (order) {
      await orderRepo.markAsRead(orderId, 'sales');
    }

    return success();
  } catch (e) {
    return error(e.message, 401);
  }
}
