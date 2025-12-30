/**
 * 管理端订单详情 API
 * GET /api/manage/orders/:id - 获取详情
 * PATCH /api/manage/orders/:id - 更新订单（需 reason）
 * PATCH /api/manage/orders/:id/status - 变更状态
 * POST /api/manage/orders/:id/comment - 添加留言
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { generateId, now } from '../../utils/id.js';
import { verifyJWT, ADMIN_AUTH_COOKIE } from '../../utils/auth.js';
import { parse as parseCookie } from 'cookie';
import { ORDER_STATUSES } from '../../../_shared/utils.js';


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
        type: 'admin'
    };
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
    const { env, params } = context;
    const { id } = params;

    try {
        // 获取订单
        const order = await env.DB.prepare(`
            SELECT o.*, 
                   s.name as salesperson_name, s.store as salesperson_store, s.phone as salesperson_phone,
                   f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN salespersons s ON o.salesperson_id = s.id
            LEFT JOIN files f ON o.main_image_id = f.id
            WHERE o.id = ?
        `).bind(id).first();

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
        `).bind(id).all();

        // 获取时间轴
        const { results: timeline } = await env.DB.prepare(`
            SELECT id, action_type, actor_type, actor_name, field_name, old_value, new_value, reason, comment, created_at
            FROM order_timeline
            WHERE order_id = ?
            ORDER BY created_at DESC
        `).bind(id).all();

        const originalData = order.original_data ? JSON.parse(order.original_data) : {};
        const currentData = order.current_data ? JSON.parse(order.current_data) : {};

        return success({
            id: order.id,
            orderNo: order.order_no,
            status: order.status,
            hasNewFeedback: !!order.has_new_feedback,
            originalData,
            currentData,
            mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
            mainImageId: order.main_image_id,
            salesperson: {
                id: order.salesperson_id,
                name: order.salesperson_name,
                store: order.salesperson_store,
                phone: order.salesperson_phone
            },
            files: files.map(f => ({
                id: f.id,
                name: f.original_name,
                url: `/file/${f.storage_key}`,
                mimeType: f.mime_type,
                size: f.size,
                section: f.section
            })),
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
        const { updates, reason } = body;

        if (!updates || Object.keys(updates).length === 0) {
            return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
        }

        if (!reason || !reason.trim()) {
            return error(MSG.ORDER.REASON_REQUIRED, 400);
        }

        // 获取当前订单
        const order = await env.DB.prepare(`
            SELECT id, current_data FROM orders WHERE id = ?
        `).bind(id).first();

        if (!order) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        const currentData = order.current_data ? JSON.parse(order.current_data) : {};
        const newData = { ...currentData };
        const timelinePromises = [];

        // 逐字段更新并记录时间轴
        for (const [field, value] of Object.entries(updates)) {
            if (currentData[field] !== value) {
                // 记录时间轴
                timelinePromises.push(logTimeline(env.DB, {
                    orderId: id,
                    actionType: 'field_updated',
                    actorType: 'admin',
                    actorId: admin.id,
                    actorName: admin.name,
                    fieldName: field,
                    oldValue: currentData[field] || '',
                    newValue: value || '',
                    reason: reason.trim()
                }));
                newData[field] = value;
            }
        }

        // 处理文件更新 (SOTA: 单独处理关联表)
        if (updates.fileIds) {
            const newFileIds = updates.fileIds;
            // 获取旧文件列表 (用于时间轴对比)
            const { results: oldFiles } = await env.DB.prepare('SELECT file_id FROM order_files WHERE order_id = ? ORDER BY sort_order').bind(id).all();
            const oldFileIds = oldFiles.map(f => f.file_id);

            // 简单对比是否变化
            if (JSON.stringify(newFileIds) !== JSON.stringify(oldFileIds)) {
                // 删除旧关联
                await env.DB.prepare('DELETE FROM order_files WHERE order_id = ?').bind(id).run();

                // 插入新关联
                if (newFileIds.length > 0) {
                    const insertStatements = newFileIds.map((fileId, index) =>
                        env.DB.prepare(`
                            INSERT OR IGNORE INTO order_files (id, order_id, file_id, section, sort_order, added_at)
                            VALUES (?, ?, ?, 'product', ?, ?)
                        `).bind(generateId(), id, fileId, index, now())
                    );
                    await env.DB.batch(insertStatements);

                    // 更新主图 (第一张)
                    await env.DB.prepare('UPDATE orders SET main_image_id = ? WHERE id = ?').bind(newFileIds[0], id).run();

                    // SOTA: 自动归档 (Admin)
                    try {
                        // 获取销售人员信息用于归档
                        const sp = await env.DB.prepare('SELECT s.name, o.order_no FROM orders o JOIN salespersons s ON o.salesperson_id = s.id WHERE o.id = ?').bind(id).first();

                        if (sp) {
                            const { ensureFolder, moveFilesToFolder } = await import('../../utils/folder-utils.js');
                            const rootId = await ensureFolder(env, 'Sales Uploads', 'root');
                            const spId = await ensureFolder(env, sp.name, rootId);
                            const folderId = await ensureFolder(env, sp.order_no || id, spId);
                            await moveFilesToFolder(env, newFileIds, folderId);
                        }
                    } catch (e) {
                        console.error('Admin Archive error', e);
                    }
                } else {
                    // 清空主图
                    await env.DB.prepare('UPDATE orders SET main_image_id = NULL WHERE id = ?').bind(id).run();
                }

                // 记录时间轴
                timelinePromises.push(logTimeline(env.DB, {
                    orderId: id,
                    actionType: 'files_updated',
                    actorType: 'admin',
                    actorId: admin.id,
                    actorName: admin.name,
                    oldValue: `${oldFileIds.length} images`,
                    newValue: `${newFileIds.length} images`,
                    reason: reason.trim()
                }));
            }
            // 从 newData 中移除 fileIds (因为它不是 current_data 的一部分)
            delete newData.fileIds;
        }

        if (timelinePromises.length === 0) {
            return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
        }

        // 更新订单
        await env.DB.prepare(`
            UPDATE orders SET current_data = ?, has_new_feedback = 1, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(newData), now(), id).run();

        // 等待时间轴记录完成
        await Promise.all(timelinePromises);

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
        const body = await request.json();
        const { status, note } = body;

        if (!status || !ORDER_STATUSES.includes(status)) {
            return error(MSG.ORDER.INVALID_STATUS, 400);
        }

        // 获取当前订单
        const order = await env.DB.prepare(`
            SELECT id, status FROM orders WHERE id = ?
        `).bind(id).first();

        if (!order) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        if (order.status === status) {
            return error('状态未变更', 400);
        }

        // 更新状态
        await env.DB.prepare(`
            UPDATE orders SET status = ?, has_new_feedback = 1, updated_at = ? WHERE id = ?
        `).bind(status, now(), id).run();

        // 记录时间轴
        await logTimeline(env.DB, {
            orderId: id,
            actionType: 'status_changed',
            actorType: 'admin',
            actorId: admin.id,
            actorName: admin.name,
            oldValue: order.status,
            newValue: status,
            reason: note || null
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
        const body = await request.json();
        const { comment } = body;

        if (!comment || !comment.trim()) {
            return error(MSG.COMMON.INVALID_PARAMS + ': 留言内容不能为空', 400);
        }

        // 验证订单存在
        const order = await env.DB.prepare(`
            SELECT id FROM orders WHERE id = ?
        `).bind(id).first();

        if (!order) {
            return error(MSG.ORDER.NOT_FOUND, 404);
        }

        // 记录时间轴
        await logTimeline(env.DB, {
            orderId: id,
            actionType: 'comment',
            actorType: 'admin',
            actorId: admin.id,
            actorName: admin.name,
            comment: comment.trim()
        });

        // 更新订单（设置红点）
        await env.DB.prepare(`
            UPDATE orders SET has_new_feedback = 1, updated_at = ? WHERE id = ?
        `).bind(now(), id).run();

        return success(null, MSG.ORDER.COMMENT_ADDED);

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED) {
            return error(err.message, 401);
        }
        console.error('Order comment error:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
