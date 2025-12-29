/**
 * 销售端订单列表/创建 API
 * GET /api/order/:token/orders - 获取订单列表
 * POST /api/order/:token/orders - 创建新订单
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { generateId, generateShareToken, now } from '../../../utils/id.js';
import { verifyJWT } from '../../../utils/auth.js';
import { parse as parseCookie } from 'cookie';

// 订单状态列表
const ORDER_STATUSES = ['pending', 'confirmed', 'rejected', 'production', 'shipping', 'arrived', 'delivered'];

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

    // 验证 token 匹配
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
 * 生成订单编号
 */
function generateOrderNo() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${dateStr}-${random}`;
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
 * GET - 获取订单列表
 */
export async function onRequestGet(context) {
    const { env, params, request } = context;
    const accessToken = params.token;

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const status = url.searchParams.get('status');
        const offset = (page - 1) * limit;

        // 构建查询
        let whereClause = 'WHERE salesperson_id = ?';
        const bindParams = [salesperson.id];

        if (status && ORDER_STATUSES.includes(status)) {
            whereClause += ' AND status = ?';
            bindParams.push(status);
        }

        // 获取总数
        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM orders ${whereClause}
        `).bind(...bindParams).first();

        // 获取订单列表
        const { results: orders } = await env.DB.prepare(`
            SELECT 
                o.id, o.order_no, o.current_data, o.status, o.has_new_feedback,
                o.main_image_id, o.created_at, o.updated_at,
                f.storage_key as main_image_key
            FROM orders o
            LEFT JOIN files f ON o.main_image_id = f.id
            ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `).bind(...bindParams, limit, offset).all();

        // 格式化返回数据
        const formattedOrders = orders.map(order => {
            const currentData = order.current_data ? JSON.parse(order.current_data) : {};
            return {
                id: order.id,
                orderNo: order.order_no,
                productName: currentData.name || '',
                status: order.status,
                hasNewFeedback: !!order.has_new_feedback,
                mainImage: order.main_image_key ? `/file/${order.main_image_key}` : null,
                createdAt: order.created_at,
                updatedAt: order.updated_at
            };
        });

        return success({
            orders: formattedOrders,
            pagination: {
                page,
                limit,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / limit)
            }
        });

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        if (err.message === MSG.SALESPERSON.DISABLED) {
            return error(err.message, 403);
        }
        console.error('Order list error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}

/**
 * POST - 创建新订单
 */
export async function onRequestPost(context) {
    const { env, params, request } = context;
    const accessToken = params.token;

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);
        const body = await request.json();

        const { name, size, color, material, remark, deadline, brand, series, fileIds = [] } = body;

        if (!name) {
            return error(MSG.COMMON.INVALID_PARAMS + ': 商品名称不能为空', 400);
        }

        const orderId = generateId();
        const orderNo = generateOrderNo();
        const timestamp = now();

        // 构建订单数据
        const orderData = JSON.stringify({
            name: name || '',
            size: size || '',
            color: color || '',
            material: material || '',
            remark: remark || '',
            deadline: deadline || '',
            brand: brand || '',
            series: series || ''
        });

        // 确定主图
        let mainImageId = null;
        if (fileIds.length > 0) {
            // 验证文件存在
            const placeholders = fileIds.map(() => '?').join(',');
            const { results: files } = await env.DB.prepare(`
                SELECT id FROM files WHERE id IN (${placeholders})
            `).bind(...fileIds).all();

            if (files.length > 0) {
                mainImageId = files[0].id;
            }
        }

        // 创建订单
        await env.DB.prepare(`
            INSERT INTO orders (id, order_no, salesperson_id, original_data, current_data, status, main_image_id, has_new_feedback, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)
        `).bind(orderId, orderNo, salesperson.id, orderData, orderData, mainImageId, timestamp, timestamp).run();

        // 关联文件
        if (fileIds.length > 0) {
            const insertStatements = fileIds.map((fileId, index) =>
                env.DB.prepare(`
                    INSERT OR IGNORE INTO order_files (id, order_id, file_id, section, sort_order, added_at)
                    VALUES (?, ?, ?, 'product', ?, ?)
                `).bind(generateId(), orderId, fileId, index, timestamp)
            );
            await env.DB.batch(insertStatements);

            // SOTA: 自动归档文件 (Sales Uploads / Salesperson / OrderNo)
            try {
                const { ensureFolder, moveFilesToFolder } = await import('../../../utils/folder-utils.js');
                const rootId = await ensureFolder(env, 'Sales Uploads', 'root');
                const spId = await ensureFolder(env, salesperson.name, rootId);
                const folderId = await ensureFolder(env, orderNo, spId);
                await moveFilesToFolder(env, fileIds, folderId);
            } catch (e) {
                console.error('File archiving error:', e);
            }
        }

        // 记录时间轴
        await logTimeline(env.DB, {
            orderId,
            actionType: 'created',
            actorType: 'salesperson',
            actorId: salesperson.id,
            actorName: salesperson.name
        });

        return success({
            id: orderId,
            orderNo
        }, MSG.ORDER.CREATE_SUCCESS, 201);

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        if (err.message === MSG.SALESPERSON.DISABLED) {
            return error(err.message, 403);
        }
        console.error('Order create error:', err);
        return error(`${MSG.COMMON.CREATE_FAILED}: ${err.message}`, 500);
    }
}
