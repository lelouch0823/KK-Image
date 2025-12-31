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
            timelineRepo.getTimeline(orderId)
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
            updatedAt: order.updatedAt
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
        const { updates } = body; // 销售端不需要 reason

        if (!updates || Object.keys(updates).length === 0) {
            return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
        }

        // 获取订单
        const order = await env.DB.prepare(`
            SELECT id, order_no, current_data, status FROM orders WHERE id = ? AND salesperson_id = ?
        `).bind(orderId, salesperson.id).first();

        if (!order) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        if (order.status !== 'pending' && order.status !== 'rejected') {
            return error(MSG.ORDER.ONLY_PENDING_CAN_EDIT, 403);
        }

        const wasRejected = order.status === 'rejected';
        const currentData = order.current_data ? JSON.parse(order.current_data) : {};
        const newData = { ...currentData };
        let hasChanges = false;

        // 允许修改的字段
        const allowedFields = ['name', 'brand', 'series', 'size', 'color', 'material', 'remark', 'deadline'];
        const timelinePromises = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined && updates[field] !== currentData[field]) {
                // 为每个修改的字段记录时间轴
                timelinePromises.push(logTimeline(env.DB, {
                    orderId,
                    actionType: 'field_updated',
                    actorType: 'salesperson',
                    actorId: salesperson.id,
                    actorName: salesperson.name,
                    fieldName: field,
                    oldValue: currentData[field] || '',
                    newValue: updates[field] || '',
                    reason: MSG.ORDER.REASON_SALES_EDIT
                }));
                newData[field] = updates[field];
                hasChanges = true;
            }
        }

        // 批量执行时间轴记录
        if (timelinePromises.length > 0) {
            await Promise.all(timelinePromises);
        }

        // 处理文件更新
        if (updates.fileIds) {
            const newFileIds = updates.fileIds;
            const { results: oldFiles } = await env.DB.prepare('SELECT file_id FROM order_files WHERE order_id = ?').bind(orderId).all();
            const oldIds = oldFiles.map(f => f.file_id).sort().join(',');
            const newIds = [...newFileIds].sort().join(',');

            if (oldIds !== newIds) {
                const orderRepo = new OrderRepository(env.DB);
                await orderRepo.updateFiles(orderId, newFileIds);

                // SOTA: 自动归档
                try {
                    const { ensureFolder, moveFilesToFolder } = await import('../../../utils/folder-utils.js');
                    const rootId = await ensureFolder(env, 'Uploads', 'root');
                    const subId = await ensureFolder(env, 'Orders', rootId);
                    const folderId = await ensureFolder(env, order.order_no || orderId, subId);
                    await moveFilesToFolder(env, newFileIds, folderId);
                } catch (e) {
                    console.error('Archive error', e);
                }
                hasChanges = true;
            }
        }

        if (!hasChanges) {
            return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
        }

        // ...
        // SOTA: Use Repository for updates to ensure consistency and correct unread logic
        const orderRepo = new OrderRepository(env.DB);

        // ... (timeline logic same) ...

        // 更新订单（如果原状态是 rejected，则重置为 pending）
        const newStatus = wasRejected ? 'pending' : order.status;

        // Update Data + Unread (Actor: sales)
        await orderRepo.updateData(orderId, newData, 'sales');

        // If status changes (e.g. resubmit), update status too
        if (newStatus !== order.status) {
            await orderRepo.updateStatus(orderId, newStatus, 'sales');
        }

        // 如果从 rejected 变为 pending，记录状态变更
        if (wasRejected) {
            await logTimeline(env.DB, {
                orderId,
                actionType: 'status_changed',
                actorType: 'salesperson',
                actorId: salesperson.id,
                actorName: salesperson.name,
                oldValue: 'rejected',
                newValue: 'pending',
                reason: MSG.ORDER.REASON_RESUBMIT
            });
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

        const order = await env.DB.prepare(`
            SELECT id, status FROM orders WHERE id = ? AND salesperson_id = ?
        `).bind(orderId, salesperson.id).first();

        if (!order) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        if (order.status !== 'pending') {
            return error(MSG.ORDER.ONLY_PENDING_CAN_VOID, 403);
        }

        // 软删除 -> void
        await env.DB.prepare(`
            UPDATE orders SET status = 'void', updated_at = ? WHERE id = ?
        `).bind(now(), orderId).run();

        await logTimeline(env.DB, {
            orderId,
            actionType: 'status_changed',
            actorType: 'salesperson',
            actorId: salesperson.id,
            actorName: salesperson.name,
            oldValue: order.status,
            newValue: 'void',
            reason: MSG.ORDER.REASON_SALES_VOID
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
        await env.DB.prepare('UPDATE orders SET has_new_feedback = 0 WHERE id = ? AND salesperson_id = ?')
            .bind(orderId, salesperson.id).run();
        return success();
    } catch (e) {
        return error(e.message, 401);
    }
}


