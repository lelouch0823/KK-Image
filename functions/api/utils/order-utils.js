/**
 * 订单更新工具函数
 * 共享管理端和销售端的订单编辑逻辑
 * @module utils/order-utils
 */

import { OrderRepository } from '../../repositories/OrderRepository.js';
import { OrderTimelineRepository } from '../../repositories/OrderTimelineRepository.js';
import { NotificationRepository } from '../../repositories/NotificationRepository.js';
import { MSG } from './messages.js';

// 订单状态显示名称 (引用 messages.js)
const STATUS_LABELS = MSG.ORDER.STATUS;

// ========================================
// 订单通知辅助函数
// ========================================

/**
 * 通知事件类型映射
 * 使用 i18n key 格式，前端可解析渲染
 */
const NOTIFICATION_EVENTS = {
  // 销售端触发 -> 管理端接收
  ORDER_CREATED: {
    titleKey: 'notification.order.created',
    contentKey: 'notification.order.createdDesc',
  },
  ORDER_UPDATED_BY_SALES: {
    titleKey: 'notification.order.updated',
    contentKey: 'notification.order.updatedDesc',
  },
  ORDER_COMMENTED_BY_SALES: {
    titleKey: 'notification.order.commented',
    contentKey: 'notification.order.commentedDesc',
  },
  // 管理端触发 -> 销售端接收
  ORDER_STATUS_CHANGED: {
    titleKey: 'notification.order.statusChanged',
    contentKey: 'notification.order.statusChangedDesc',
  },
  ORDER_UPDATED_BY_ADMIN: {
    titleKey: 'notification.order.updated',
    contentKey: 'notification.order.updatedDesc',
  },
  ORDER_COMMENTED_BY_ADMIN: {
    titleKey: 'notification.order.commented',
    contentKey: 'notification.order.commentedDesc',
  },
  ORDER_BATCH_STATUS_CHANGED: {
    titleKey: 'notification.order.batchStatusChanged',
    contentKey: 'notification.order.batchStatusChangedDesc',
  },
};

/**
 * 创建订单相关通知
 * @param {D1Database} db - 数据库实例
 * @param {Object} options - 通知选项
 * @param {string} options.event - 事件类型 (NOTIFICATION_EVENTS 的 key)
 * @param {string} options.orderId - 订单 ID
 * @param {string} options.orderNo - 订单编号
 * @param {'admin'|'sales'} options.receiver - 接收方
 * @param {string} [options.salespersonId] - 销售员 ID (receiver='sales' 时必填)
 * @param {string} [options.actorName] - 操作者名称
 * @param {Object} [options.extra] - 额外参数 (如 status, count 等)
 * @returns {Promise<void>}
 */
export async function createOrderNotification(db, options) {
  const { event, orderId, orderNo, receiver, salespersonId, actorName, extra = {} } = options;

  const eventConfig = NOTIFICATION_EVENTS[event];
  if (!eventConfig) {
    console.warn(`Unknown notification event: ${event}`);
    return;
  }

  // 构建显示参数
  const displayExtra = { ...extra };
  if (displayExtra.status && STATUS_LABELS[displayExtra.status]) {
    displayExtra.status = STATUS_LABELS[displayExtra.status];
  }

  // 构建 i18n 格式的标题和内容
  // 格式: JSON.stringify({ key: 'i18n.key', orderNo: '...', actor: '...' })
  const titleData = {
    key: eventConfig.titleKey,
    orderNo,
    ...displayExtra,
  };

  const contentData = {
    key: eventConfig.contentKey,
    orderNo,
    actor: actorName || '',
    salesperson: actorName || '',
    ...displayExtra,
  };

  // 构建跳转链接
  const link = receiver === 'admin'
    ? `/admin/orders?id=${orderId}`
    : `/orders/${orderId}`;

  const notificationRepo = new NotificationRepository(db);
  await notificationRepo.create({
    type: 'order',
    title: JSON.stringify(titleData),
    content: JSON.stringify(contentData),
    link,
    receiver,
    salespersonId: receiver === 'sales' ? salespersonId : null,
    orderId,
    metadata: { event, ...extra },
  });
}

/**
 * 批量创建通知（用于批量订单操作）
 * @param {D1Database} db - 数据库实例
 * @param {Array<Object>} notifications - 通知配置数组
 * @returns {Promise<void>}
 */
export async function createBatchOrderNotifications(db, notifications) {
  if (!notifications || notifications.length === 0) return;

  const notificationRepo = new NotificationRepository(db);
  const notificationRecords = notifications.map((n) => {
    const eventConfig = NOTIFICATION_EVENTS[n.event] || {};

    // 构建显示参数
    const displayExtra = { ...n.extra };
    if (displayExtra.status && STATUS_LABELS[displayExtra.status]) {
      displayExtra.status = STATUS_LABELS[displayExtra.status];
    }

    const titleData = {
      key: eventConfig.titleKey || 'notification.order.updated',
      orderNo: n.orderNo,
      ...displayExtra,
    };

    const contentData = {
      key: eventConfig.contentKey || 'notification.order.updatedDesc',
      orderNo: n.orderNo,
      actor: n.actorName || '',
      ...displayExtra,
    };

    return {
      type: 'order',
      title: JSON.stringify(titleData),
      content: JSON.stringify(contentData),
      link: n.receiver === 'admin' ? `/admin/orders?id=${n.orderId}` : `/orders/${n.orderId}`,
      receiver: n.receiver,
      salespersonId: n.receiver === 'sales' ? n.salespersonId : null,
      orderId: n.orderId,
      metadata: { event: n.event, ...n.extra },
    };
  });

  await notificationRepo.createBatch(notificationRecords);
}


/**
 * 检测并更新订单文件
 * @param {Object} env - 环境对象
 * @param {string} orderId - 订单 ID
 * @param {string} orderNo - 订单编号（用于归档）
 * @param {Array<string>} newFileIds - 新的文件 ID 列表
 * @param {Object} actor - 操作者信息 { type: 'admin'|'salesperson', id, name }
 * @param {string} reason - 修改原因
 * @returns {Promise<boolean>} 是否有变更
 */
export async function updateOrderFiles(env, orderId, orderNo, newFileIds, actor, reason) {
  if (!newFileIds || !Array.isArray(newFileIds)) {
    return false;
  }

  // 获取旧文件列表
  const { results: oldFiles } = await env.DB.prepare(
    'SELECT file_id FROM order_files WHERE order_id = ? ORDER BY sort_order'
  )
    .bind(orderId)
    .all();
  const oldFileIds = oldFiles.map((f) => f.file_id);

  // 比较文件列表（顺序敏感）
  if (JSON.stringify(newFileIds) === JSON.stringify(oldFileIds)) {
    return false; // 没有变化
  }

  // 更新文件关联
  const orderRepo = new OrderRepository(env.DB);
  await orderRepo.updateFiles(orderId, newFileIds);

  // SOTA: 同步更新 main_image_id 为第一个文件
  const newMainImageId = newFileIds.length > 0 ? newFileIds[0] : null;
  await env.DB.prepare('UPDATE orders SET main_image_id = ?, updated_at = ? WHERE id = ?')
    .bind(newMainImageId, Date.now(), orderId)
    .run();

  // SOTA: 自动归档到文件夹
  try {
    const { ensureOrderFolder, moveFilesToFolder } = await import('./folder-utils.js');
    const folderId = await ensureOrderFolder(env, orderNo || orderId);
    await moveFilesToFolder(env, newFileIds, folderId);
  } catch (e) {
    console.error('File archiving error:', e);
  }

  // 记录时间轴
  const timelineRepo = new OrderTimelineRepository(env.DB);
  await timelineRepo.addTimelineEntry(orderId, {
    actionType: 'field_updated',
    fieldName: 'files',
    actorType: actor.type,
    actorId: actor.id,
    actorName: actor.name,
    oldValue: `${oldFileIds.length} ${MSG.ORDER.IMAGES}`,
    newValue: `${newFileIds.length} ${MSG.ORDER.IMAGES}`,
    reason: reason || '',
  });

  return true;
}

/**
 * 检测字段变更并记录时间轴
 * @param {Object} env - 环境对象
 * @param {string} orderId - 订单 ID
 * @param {Object} currentData - 当前数据
 * @param {Object} updates - 更新数据
 * @param {Array<string>} allowedFields - 允许更新的字段列表
 * @param {Object} actor - 操作者信息 { type: 'admin'|'salesperson', id, name }
 * @param {string} reason - 修改原因
 * @returns {Promise<{newData: Object, hasChanges: boolean}>}
 */
export async function detectAndLogFieldChanges(
  env,
  orderId,
  currentData,
  updates,
  allowedFields,
  actor,
  reason
) {
  const newData = { ...currentData };
  const timelinePromises = [];
  let hasChanges = false;
  const timelineRepo = new OrderTimelineRepository(env.DB); // SOTA: 单例化

  for (const field of allowedFields) {
    if (updates[field] !== undefined && updates[field] !== currentData[field]) {
      timelinePromises.push(
        timelineRepo.addTimelineEntry(orderId, {
          actionType: 'field_updated',
          actorType: actor.type,
          actorId: actor.id,
          actorName: actor.name,
          fieldName: field,
          oldValue: currentData[field] || '',
          newValue: updates[field] || '',
          reason: reason || '',
        })
      );
      newData[field] = updates[field];
      hasChanges = true;
    }
  }

  // 并行执行时间轴记录
  if (timelinePromises.length > 0) {
    await Promise.all(timelinePromises);
  }

  return { newData, hasChanges };
}

/**
 * 完整的订单更新流程
 * @param {Object} options - 更新选项
 * @param {Object} options.env - 环境对象
 * @param {string} options.orderId - 订单 ID
 * @param {string} options.orderNo - 订单编号
 * @param {Object} options.currentData - 当前订单数据
 * @param {Object} options.updates - 更新数据（不包含 fileIds）
 * @param {Array<string>} [options.fileIds] - 新的文件 ID 列表
 * @param {Array<string>} options.allowedFields - 允许更新的字段列表
 * @param {Object} options.actor - 操作者信息 { type: 'admin'|'salesperson', id, name }
 * @param {string} options.reason - 修改原因
 * @returns {Promise<{success: boolean, hasChanges: boolean, newData: Object}>}
 */
export async function processOrderUpdate(options) {
  const { env, orderId, orderNo, currentData, updates, fileIds, allowedFields, actor, reason } =
    options;

  // 1. 检测字段变更
  const { newData, hasChanges: dataChanged } = await detectAndLogFieldChanges(
    env,
    orderId,
    currentData,
    updates || {},
    allowedFields,
    actor,
    reason
  );

  // 2. 检测文件变更
  const filesChanged = await updateOrderFiles(env, orderId, orderNo, fileIds, actor, reason);

  // 3. 如果有任何变更，更新订单
  if (dataChanged || filesChanged) {
    const orderRepo = new OrderRepository(env.DB);
    await orderRepo.updateData(orderId, newData, actor.type === 'admin' ? 'admin' : 'sales');
    return { success: true, hasChanges: true, newData };
  }

  return { success: true, hasChanges: false, newData };
}
