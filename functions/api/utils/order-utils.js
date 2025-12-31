/**
 * 订单更新工具函数
 * 共享管理端和销售端的订单编辑逻辑
 * @module utils/order-utils
 */

import { OrderRepository } from '../../repositories/OrderRepository.js';
import { OrderTimelineRepository } from '../../repositories/OrderTimelineRepository.js';
import { ensureFolder, moveFilesToFolder } from './folder-utils.js';
import { MSG } from './messages.js';

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
    ).bind(orderId).all();
    const oldFileIds = oldFiles.map(f => f.file_id);

    // 比较文件列表（顺序敏感）
    if (JSON.stringify(newFileIds) === JSON.stringify(oldFileIds)) {
        return false; // 没有变化
    }

    // 更新文件关联
    const orderRepo = new OrderRepository(env.DB);
    await orderRepo.updateFiles(orderId, newFileIds);

    // SOTA: 自动归档到文件夹
    try {
        const rootId = await ensureFolder(env, 'Uploads', 'root');
        const subId = await ensureFolder(env, 'Orders', rootId);
        const folderId = await ensureFolder(env, orderNo || orderId, subId);
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
        reason: reason || ''
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
export async function detectAndLogFieldChanges(env, orderId, currentData, updates, allowedFields, actor, reason) {
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
                    reason: reason || ''
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
    const { env, orderId, orderNo, currentData, updates, fileIds, allowedFields, actor, reason } = options;

    // 1. 检测字段变更
    const { newData, hasChanges: dataChanged } = await detectAndLogFieldChanges(
        env, orderId, currentData, updates || {}, allowedFields, actor, reason
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
