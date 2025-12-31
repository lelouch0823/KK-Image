/**
 * 管理端销售人员 API
 * GET /api/manage/salespersons - 获取销售列表
 * POST /api/manage/salespersons - 创建销售
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { generateId, generateShareToken, hashPassword, now } from '../../utils/id.js';

import { authenticateAdmin } from '../../utils/auth.js';

/**
 * GET - 获取销售列表
 */
export async function onRequestGet(context) {
    const { env, request } = context;

    try {
        await authenticateAdmin(request, env);
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const search = url.searchParams.get('search') || '';
        const offset = (page - 1) * limit;

        // 构建查询
        let whereClause = '1=1';
        const bindParams = [];

        if (search) {
            whereClause += ' AND (name LIKE ? OR store LIKE ? OR phone LIKE ?)';
            const searchPattern = `%${search}%`;
            bindParams.push(searchPattern, searchPattern, searchPattern);
        }

        // 获取总数
        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM salespersons WHERE ${whereClause}
        `).bind(...bindParams).first();

        // 获取销售列表 + 订单数
        const { results: salespersons } = await env.DB.prepare(`
            SELECT 
                s.*,
                (SELECT COUNT(*) FROM orders WHERE salesperson_id = s.id) as order_count
            FROM salespersons s
            WHERE ${whereClause}
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `).bind(...bindParams, limit, offset).all();

        return success({
            salespersons: salespersons.map(s => ({
                id: s.id,
                name: s.name,
                store: s.store,
                phone: s.phone,
                accessToken: s.access_token,
                isActive: !!s.is_active,
                orderCount: s.order_count,
                createdAt: s.created_at,
                updatedAt: s.updated_at
            })),
            pagination: {
                page,
                limit,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / limit)
            }
        });

    } catch (err) {
        console.error('Salesperson list error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}

/**
 * POST - 创建销售
 */
export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        await authenticateAdmin(request, env);
        const body = await request.json();
        const { name, store, phone, password } = body;

        if (!name || !name.trim()) {
            return error(MSG.SALESPERSON.NAME_REQUIRED, 400);
        }

        if (!password) {
            return error(MSG.SALESPERSON.PASSWORD_REQUIRED, 400);
        }

        const id = generateId();
        const accessToken = generateShareToken(12);
        const passwordHash = await hashPassword(password, env.JWT_SECRET);
        const timestamp = now();

        // 尝试插入（处理 token 冲突）
        let retries = 3;
        while (retries > 0) {
            try {
                await env.DB.prepare(`
                    INSERT INTO salespersons (id, name, store, phone, access_token, password_hash, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                `).bind(id, name.trim(), store || null, phone || null, accessToken, passwordHash, timestamp, timestamp).run();
                break;
            } catch (e) {
                if (e.message.includes('UNIQUE constraint failed') && retries > 1) {
                    retries--;
                    continue;
                }
                throw e;
            }
        }

        return success({
            id,
            name: name.trim(),
            store,
            phone,
            accessToken,
            accessUrl: `/order/${accessToken}`
        }, MSG.SALESPERSON.CREATE_SUCCESS, 201);

    } catch (err) {
        console.error('Salesperson create error:', err);
        return error(`${MSG.COMMON.CREATE_FAILED}: ${err.message}`, 500);
    }
}
