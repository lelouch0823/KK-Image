/**
 * 销售端订单详情 API
 * GET /api/order/:token/orders/:id - 获取订单详情
 * POST /api/order/:token/orders/:id/comment - 添加留言
 * PATCH /api/order/:token/orders/:id/read - 清除红点
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { generateId, now } from '../../../utils/id.js';
import { verifyJWT } from '../../../utils/auth.js';
import { parse as parseCookie } from 'cookie';

/**
 * 验证销售端 JWT 并返回销售信息
 */
async function authenticateSalesperson(request, env, accessToken) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookie(cookieHeader);
    const jwt = cookies.sales_token;

    if (!jwt) {
        throw new Error(MSG.AUTH.REQUIRED);
    }

    const payload = await verifyJWT(jwt, env);
    if (payload.type !== 'salesperson') {
        throw new Error(MSG.AUTH.FORBIDDEN);
    }

    const salesperson = await env.DB.prepare(`
        SELECT id, name, store, is_active
        FROM salespersons WHERE id = ? AND access_token = ?
    `).bind(payload.id, accessToken).first();

    if (!salesperson) {
        throw new Error(MSG.SALESPERSON.NOT_FOUND);
    }

    if (!salesperson.is_active) {
        throw new Error(MSG.SALESPERSON.DISABLED);
    }

    return salesperson;
}

/**
 * 记录时间轴
 */
async function logTimeline(db, params) {
    const {
        orderId,
        actionType,
        actorType,
        actorId,
        actorName,
        fieldName = null,
        oldValue = null,
        newValue = null,
        reason = null,
        comment = null
    } = params;

    await db.prepare(`
        INSERT INTO order_timeline (id, order_id, action_type, actor_type, actor_id, actor_name, field_name, old_value, new_value, reason, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        generateId(),
        orderId,
        actionType,
        actorType,
        actorId,
        actorName,
        fieldName,
        oldValue,
        newValue,
        reason,
        comment,
        now()
    ).run();
}

/**
 * GET - 获取订单详情
 */
export async function onRequestGet(context) {
    const { env, params, request } = context;
    const { token: accessToken, id: orderId } = params;

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);

        // 获取订单
        const order = await env.DB.prepare(`
            SELECT o.*, f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE o.id = ? AND o.salesperson_id = ?
        `).bind(orderId, salesperson.id).first();

        if (!order) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        // 获取订单图片
        const { results: files } = await env.DB.prepare(`
            SELECT of.section, of.sort_order, f.id, f.original_name, f.storage_key, f.mime_type, f.size
            FROM order_files of
            JOIN files f ON of.file_id = f.id
            WHERE of.order_id = ?
            ORDER BY of.section, of.sort_order
        `).bind(orderId).all();

        // 获取时间轴
        const { results: timeline } = await env.DB.prepare(`
            SELECT id, action_type, actor_type, actor_name, field_name, old_value, new_value, reason, comment, created_at
            FROM order_timeline
            WHERE order_id = ?
            ORDER BY created_at DESC
        `).bind(orderId).all();

        // 解析数据
        const originalData = order.original_data ? JSON.parse(order.original_data) : {};
        const currentData = order.current_data ? JSON.parse(order.current_data) : {};

        // 格式化文件
        const formattedFiles = files.map(f => ({
            id: f.id,
            name: f.original_name,
            url: `/file/${f.storage_key}`,
            mimeType: f.mime_type,
            size: f.size,
            section: f.section
        }));

        return success({
            id: order.id,
            orderNo: order.order_no,
            status: order.status,
            hasNewFeedback: !!order.has_new_feedback,
            originalData,
            currentData,
            mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
            mainImageId: order.main_image_id,
            files: formattedFiles,
            timeline: timeline.map(t => ({
                id: t.id,
                actionType: t.action_type,
                actorType: t.actor_type,
                actorName: t.actor_name,
                fieldName: t.field_name,
                oldValue: t.old_value,
                newValue: t.new_value,
                reason: t.reason,
                comment: t.comment,
                createdAt: t.created_at
            })),
            createdAt: order.created_at,
            updatedAt: order.updated_at
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

        if (order.status !== 'pending') {
            return error(MSG.ORDER.ONLY_PENDING_CAN_EDIT, 403);
        }

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
                // 删除旧关联
                await env.DB.prepare('DELETE FROM order_files WHERE order_id = ?').bind(orderId).run();

                // 插入新关联
                if (newFileIds.length > 0) {
                    const insertStatements = newFileIds.map((fileId, index) =>
                        env.DB.prepare(`
                             INSERT OR IGNORE INTO order_files (id, order_id, file_id, section, sort_order, added_at)
                             VALUES (?, ?, ?, 'product', ?, ?)
                         `).bind(generateId(), orderId, fileId, index, now())
                    );
                    await env.DB.batch(insertStatements);

                    // 更新主图 (第一张)
                    await env.DB.prepare('UPDATE orders SET main_image_id = ? WHERE id = ?').bind(newFileIds[0], orderId).run();

                    // SOTA: 自动归档
                    try {
                        const { ensureFolder, moveFilesToFolder } = await import('../../../utils/folder-utils.js');
                        const rootId = await ensureFolder(env, 'Sales Uploads', 'root');
                        const spId = await ensureFolder(env, salesperson.name, rootId);
                        const folderId = await ensureFolder(env, order.order_no || orderId, spId);
                        await moveFilesToFolder(env, newFileIds, folderId);
                    } catch (e) {
                        console.error('Archive error', e);
                    }
                } else {
                    // 清空主图
                    await env.DB.prepare('UPDATE orders SET main_image_id = NULL WHERE id = ?').bind(orderId).run();
                }
                hasChanges = true;
            }
        }

        if (!hasChanges) {
            return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
        }

        // 更新订单
        await env.DB.prepare(`
            UPDATE orders SET current_data = ?, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(newData), now(), orderId).run();

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


