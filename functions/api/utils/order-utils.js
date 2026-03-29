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

function buildOrderDomainEvent({ eventType, orderId, orderNo, salespersonId = null, actorName = '', extra = {} }) {
  return {
    event_type: eventType,
    aggregate_type: 'order',
    aggregate_id: orderId,
    payload: {
      order_id: orderId,
      order_no: orderNo,
      salesperson_id: salespersonId || null,
      actor_name: actorName || '',
      ...extra,
    },
  };
}

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
  _actor,
  _reason
) {
  const newData = { ...currentData };
  const fieldChanges = [];
  let hasChanges = false;

  for (const field of allowedFields) {
    if (updates[field] !== undefined && updates[field] !== currentData[field]) {
      fieldChanges.push({
        fieldName: field,
        oldValue: currentData[field] || '',
        newValue: updates[field] || '',
      });
      newData[field] = updates[field];
      hasChanges = true;
    }
  }

  return { newData, hasChanges, fieldChanges };
}

async function detectOrderFileChanges(db, orderId, newFileIds) {
  if (!Array.isArray(newFileIds)) {
    return { hasChanges: false, oldFileIds: [], newFileIds: [] };
  }
  const { results: oldFiles } = await db.prepare(
    'SELECT file_id FROM order_files WHERE order_id = ? ORDER BY sort_order'
  ).bind(orderId).all();
  const oldFileIds = (oldFiles || []).map((f) => f.file_id);
  const hasChanges = JSON.stringify(newFileIds) !== JSON.stringify(oldFileIds);
  return { hasChanges, oldFileIds, newFileIds };
}

async function archiveOrderFilesSafe(env, orderNo, orderId, fileIds) {
  if (!Array.isArray(fileIds)) return;
  try {
    const { ensureOrderFolder, moveFilesToFolder } = await import('./folder-utils.js');
    const folderId = await ensureOrderFolder(env, orderNo || orderId);
    await moveFilesToFolder(env, fileIds, folderId);
  } catch (e) {
    console.error('File archiving error:', e);
  }
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
  const { env, orderId, orderNo, currentData, updates, fileIds, allowedFields, actor, reason, salespersonId } =
    options;
  const currentStatus = options.currentStatus ?? currentData?.status;
  const baselineData = { ...currentData, status: currentStatus };
  const deferNotifications = Boolean(options.deferNotifications);

  // 1. 检测字段变更
  const { newData, hasChanges: dataChanged, fieldChanges } = await detectAndLogFieldChanges(
    env,
    orderId,
    baselineData,
    updates || {},
    allowedFields,
    actor,
    reason
  );

  // 2. 检测文件变更
  const fileChange = await detectOrderFileChanges(env.DB, orderId, fileIds);
  const filesChanged = fileChange.hasChanges;

  // 3. 检测商品绑定变更（orders 顶级列，独立于 current_data JSON）
  const productIdChanged =
    options.productId !== undefined &&
    (options.currentProductId === undefined || options.productId !== options.currentProductId);
  const variantIdChanged =
    options.variantId !== undefined &&
    (options.currentVariantId === undefined || options.variantId !== options.currentVariantId);
  const statusChanged = updates?.status !== undefined && updates.status !== currentStatus;

  // 4. 如果有任何变更（数据/文件/商品绑定），更新订单并发送通知
  if (dataChanged || filesChanged || productIdChanged || variantIdChanged) {
    const orderRepo = new OrderRepository(env.DB);
    const actorTypeStr = actor.type === 'admin' ? 'admin' : 'sales';

    await orderRepo.updateComposite({
      id: orderId,
      actorType: actorTypeStr,
      newData,
      productId: options.productId,
      variantId: options.variantId,
      status: statusChanged ? updates.status : undefined,
      fileIds: filesChanged ? fileChange.newFileIds : undefined,
      forceStatusTransition: Boolean(options.forceStatusTransition),
    });

    const timelineRepo = new OrderTimelineRepository(env.DB);
    const timelineTasks = (fieldChanges || []).map((change) => timelineRepo.addTimelineEntry(orderId, {
      actionType: 'field_updated',
      actorType: actor.type,
      actorId: actor.id,
      actorName: actor.name,
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      reason: reason || '',
    }));
    if (filesChanged) {
      timelineTasks.push(
        timelineRepo.addTimelineEntry(orderId, {
          actionType: 'field_updated',
          fieldName: 'files',
          actorType: actor.type,
          actorId: actor.id,
          actorName: actor.name,
          oldValue: `${fileChange.oldFileIds.length} ${MSG.ORDER.IMAGES}`,
          newValue: `${fileChange.newFileIds.length} ${MSG.ORDER.IMAGES}`,
          reason: reason || '',
        })
      );
      await archiveOrderFilesSafe(env, orderNo, orderId, fileChange.newFileIds);
    }
    if (timelineTasks.length > 0) {
      await Promise.all(timelineTasks);
    }

    // SOTA: 自动发送通知
    // 如果是管理员修改，通知销售员
    if (actor.type === 'admin' && salespersonId) {
      if (!deferNotifications) {
        await createOrderNotification(env.DB, {
          event: 'ORDER_UPDATED_BY_ADMIN',
          orderId,
          orderNo,
          receiver: 'sales',
          salespersonId,
          actorName: actor.name,
          extra: {
            count: Object.keys(updates || {}).length + (filesChanged ? 1 : 0)
          }
        });
      }
    }
    // 如果是销售员修改，通知管理员
    else if (actor.type !== 'admin') {
      if (!deferNotifications) {
        await createOrderNotification(env.DB, {
          event: 'ORDER_UPDATED_BY_SALES',
          orderId,
          orderNo,
          receiver: 'admin',
          actorName: actor.name
        });
      }
    }

    const outboxEvents = deferNotifications
      ? [
          buildOrderDomainEvent({
            eventType: actor.type === 'admin' ? 'order_updated_by_admin' : 'order_updated_by_sales',
            orderId,
            orderNo,
            salespersonId,
            actorName: actor.name,
            extra: {
              change_count: Object.keys(updates || {}).length + (filesChanged ? 1 : 0),
            },
          }),
        ]
      : [];

    return { success: true, hasChanges: true, newData, outboxEvents };
  }

  return { success: true, hasChanges: false, newData, outboxEvents: [] };
}
