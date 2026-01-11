/**
 * 管理端订单批量操作 API
 * POST /api/manage/orders/batch - 批量操作订单
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { OrderRepository } from '../../../repositories/OrderRepository.js';
import { createBatchOrderNotifications } from '../../utils/order-utils.js';

// 允许的批量操作
const ALLOWED_ACTIONS = ['confirm', 'reject', 'void'];

// 操作到状态的映射
const ACTION_STATUS_MAP = {
  confirm: 'confirmed',
  reject: 'rejected',
  void: 'voided',
};

// 操作说明映射 (使用 MSG.ORDER.ACTIONS)
const ACTION_LABELS = MSG.ORDER.ACTIONS;

// 可以进行批量操作的源状态
const VALID_SOURCE_STATUSES = {
  confirm: ['pending'],
  reject: ['pending'],
  void: ['pending', 'confirmed', 'rejected'],
};

/**
 * POST - 批量操作订单
 * body: { action: 'confirm'|'reject'|'void', ids: [...], reason?: string }
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const { authenticateAdmin } = await import('../../utils/auth.js');
    await authenticateAdmin(request, env);
    const orderRepo = new OrderRepository(env.DB);
    const body = await request.json();
    const { action, ids, reason = '' } = body;

    // 验证参数
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return error(MSG.COMMON.INVALID_PARAMS + ': action', 400);
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return error(MSG.COMMON.INVALID_PARAMS + ': ids', 400);
    }

    if (ids.length > 100) {
      return error(MSG.ORDER.BATCH_LIMIT, 400);
    }

    const targetStatus = ACTION_STATUS_MAP[action];
    const validSourceStatuses = VALID_SOURCE_STATUSES[action];

    // 首先检查订单状态是否允许操作
    const placeholders = ids.map(() => '?').join(',');
    const { results: orders } = await env.DB.prepare(
      `
            SELECT id, status FROM orders WHERE id IN (${placeholders})
        `
    )
      .bind(...ids)
      .all();

    // 过滤出可以操作的订单
    const validOrders = orders.filter((order) => validSourceStatuses.includes(order.status));
    const validIds = validOrders.map((order) => order.id);

    if (validIds.length === 0) {
      return error(MSG.ORDER.BATCH_NO_VALID, 400);
    }

    // 构建时间轴模板
    const timelineTemplate = {
      actionType: 'status_changed',
      actorType: 'admin',
      actorName: 'Admin',
      newValue: targetStatus,
      reason: reason || `批量${ACTION_LABELS[action]}`,
    };

    // 为每个订单添加 oldValue 并使用 Repository 批量更新
    // 注意：batchUpdateStatus 需要为每个订单设置 oldValue
    // 由于订单可能有不同的原始状态，这里需要分组处理
    const ordersByOldStatus = {};
    for (const order of validOrders) {
      if (!ordersByOldStatus[order.status]) {
        ordersByOldStatus[order.status] = [];
      }
      ordersByOldStatus[order.status].push(order.id);
    }

    // 分组批量更新
    for (const [oldStatus, groupIds] of Object.entries(ordersByOldStatus)) {
      await orderRepo.batchUpdateStatus(groupIds, targetStatus, {
        ...timelineTemplate,
        oldValue: oldStatus,
      });
    }

    // SOTA: 批量创建通知 -> 通知相关销售员
    try {
      // 获取所有订单的销售员信息
      const placeholders = validIds.map(() => '?').join(',');
      const { results: orderDetails } = await env.DB.prepare(
        `SELECT id, order_no, salesperson_id FROM orders WHERE id IN (${placeholders})`
      )
        .bind(...validIds)
        .all();

      // 构建通知列表
      const notifications = orderDetails.map((o) => ({
        event: 'ORDER_STATUS_CHANGED',
        orderId: o.id,
        orderNo: o.order_no,
        receiver: 'sales',
        salespersonId: o.salesperson_id,
        actorName: '管理员', // Localized actor name
        extra: { status: targetStatus, action: ACTION_LABELS[action] },
      }));

      await createBatchOrderNotifications(env.DB, notifications);
    } catch (e) {
      console.error('Batch notification creation error:', e);
    }

    const skipped = ids.length - validIds.length;
    let message = MSG.ORDER.BATCH_RESULT.replace('{valid}', validIds.length);
    if (skipped > 0) {
      message += MSG.ORDER.BATCH_SKIPPED.replace('{skipped}', skipped);
    }

    return success(
      {
        processed: validIds.length,
        skipped: skipped,
        action: action,
      },
      message
    );
  } catch (err) {
    console.error('Batch operation error:', err);
    return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
  }
}
