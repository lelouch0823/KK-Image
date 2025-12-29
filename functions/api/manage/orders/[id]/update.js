/**
 * 管理端订单更新 API (POST)
 * POST /api/manage/orders/:id/update - 更新订单（避免 PATCH 导致的 CORS Cookie 问题）
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { generateId, now } from '../../../utils/id.js';
import { verifyJWT, ADMIN_AUTH_COOKIE } from '../../../utils/auth.js';
import { parse as parseCookie } from 'cookie';

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
        fieldName,
        oldValue,
        newValue,
        reason,
        comment
    } = params;

    // D1 不支持 undefined，必须使用 null
    await db.prepare(`
        INSERT INTO order_timeline (id, order_id, action_type, actor_type, actor_id, actor_name, field_name, old_value, new_value, reason, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        generateId(),
        orderId,
        actionType,
        actorType ?? 'admin',
        actorId ?? 'unknown',
        actorName ?? 'Unknown',
        fieldName ?? null,
        oldValue ?? null,
        newValue ?? null,
        reason ?? null,
        comment ?? null,
        now()
    ).run();
}

/**
 * POST - 更新订单 (复制自 [id].js 的 PATCH 逻辑)
 */
export async function onRequestPost(context) {
    const { env, params, request } = context;
    const { id } = params;

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
            if (field === 'fileIds') continue; // 文件单独处理
            if (currentData[field] !== value) {
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

        // 处理文件更新
        if (updates.fileIds) {
            const newFileIds = updates.fileIds;
            const { results: oldFiles } = await env.DB.prepare('SELECT file_id FROM order_files WHERE order_id = ? ORDER BY sort_order').bind(id).all();
            const oldFileIds = oldFiles.map(f => f.file_id);

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

                    // 更新主图
                    await env.DB.prepare('UPDATE orders SET main_image_id = ? WHERE id = ?').bind(newFileIds[0], id).run();

                    // 自动归档
                    try {
                        const sp = await env.DB.prepare('SELECT s.name, o.order_no FROM orders o JOIN salespersons s ON o.salesperson_id = s.id WHERE o.id = ?').bind(id).first();
                        if (sp) {
                            const { ensureFolder, moveFilesToFolder } = await import('../../../utils/folder-utils.js');
                            const rootId = await ensureFolder(env, 'Sales Uploads', 'root');
                            const spId = await ensureFolder(env, sp.name, rootId);
                            const folderId = await ensureFolder(env, sp.order_no || id, spId);
                            await moveFilesToFolder(env, newFileIds, folderId);
                        }
                    } catch (e) {
                        console.error('Admin Archive error', e);
                    }
                } else {
                    await env.DB.prepare('UPDATE orders SET main_image_id = NULL WHERE id = ?').bind(id).run();
                }

                timelinePromises.push(logTimeline(env.DB, {
                    orderId: id,
                    actionType: 'field_updated',
                    actorType: 'admin',
                    actorId: admin.id,
                    actorName: admin.name,
                    fieldName: 'images',
                    oldValue: `${oldFileIds.length} images`,
                    newValue: `${newFileIds.length} images`,
                    reason: reason.trim()
                }));
            }
        }

        if (timelinePromises.length === 0) {
            return error(MSG.COMMON.NO_UPDATE_FIELDS, 400);
        }

        // 更新订单
        await env.DB.prepare(`
            UPDATE orders SET current_data = ?, has_new_feedback = 1, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(newData), now(), id).run();

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
