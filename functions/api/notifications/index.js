/**
 * 通知管理 API
 * GET /api/notifications - 获取通知列表 (未读优先，按时间倒序)
 * POST /api/notifications - 创建通知 (供后台调用)
 */

import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    // 可选: 只获取未读 ?unread_only=true
    const unreadOnly = url.searchParams.get('unread_only') === 'true';

    try {
        let sql = `SELECT * FROM notifications`;
        const params = [];

        if (unreadOnly) {
            sql += ` WHERE is_read = 0`;
        } else {
            // WHERE 1=1 for easier appending if needed later
        }

        sql += ` ORDER BY is_read ASC, created_at DESC LIMIT ?`;
        params.push(limit);

        const { results } = await env.DB.prepare(sql).bind(...params).all();

        // 统计未读数量 (全量)
        const { count: unreadCount } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM notifications WHERE is_read = 0
        `).first();

        // 解析 metadata
        const list = results.map(n => ({
            ...n,
            metadata: n.metadata ? JSON.parse(n.metadata) : null
        }));

        return success({
            list,
            unreadCount
        });

    } catch (err) {
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}

export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        const body = await request.json();
        const { type = 'system', title, content = '', link = '', metadata = null } = body;

        if (!title) {
            return error(MSG.COMMON.INVALID_PARAMS, 400);
        }

        const id = crypto.randomUUID();
        const now = Date.now();

        await env.DB.prepare(`
            INSERT INTO notifications (id, type, title, content, link, is_read, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?)
        `).bind(
            id, type, title, content, link,
            metadata ? JSON.stringify(metadata) : null,
            now
        ).run();

        return success({ id }, MSG.COMMON.CREATE_SUCCESS);

    } catch (err) {
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
