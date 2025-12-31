/**
 * 销售端订单列表/创建 API
 * GET /api/order/:token/orders - 获取订单列表
 * POST /api/order/:token/orders - 创建新订单
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { generateId, generateOrderNo } from '../../../utils/id.js';
import { verifyJWT } from '../../../utils/auth.js';
import { parse as parseCookie } from 'cookie';
import { ORDER_STATUSES } from '../../../../_shared/utils.js';
import { OrderRepository } from '../../../../repositories/OrderRepository.js';


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
 * 生成订单编号 (SOTA)
 * 格式: ORD-YYMMDD-HHmmss-XXX
 * 示例: ORD-251230-143052-A7K
 * - 日期部分: 年月日 (6位)
 * - 时间部分: 时分秒 (6位)
 * - 随机部分: 3位大写字母/数字，防止同一秒内碰撞
 */






/**
 * GET - 获取订单列表
 */
export async function onRequestGet(context) {
    const { env, params, request } = context;
    const accessToken = params.token;

    try {
        const salesperson = await authenticateSalesperson(request, env, accessToken);
        const orderRepo = new OrderRepository(env.DB);

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const status = url.searchParams.get('status');

        const result = await orderRepo.listBySalesperson(salesperson.id, {
            status: status && ORDER_STATUSES.includes(status) ? status : null,
            page,
            limit
        });

        return success({
            orders: result.items,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages
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
        const orderRepo = new OrderRepository(env.DB);
        const body = await request.json();

        const { name, size, color, material, remark, deadline, brand, series, fileIds = [] } = body;

        if (!name) {
            return error(MSG.ORDER.NAME_REQUIRED, 400);
        }

        const orderId = generateId();
        const orderNo = generateOrderNo();

        // 构建订单数据
        const orderData = {
            name: name || '',
            size: size || '',
            color: color || '',
            material: material || '',
            remark: remark || '',
            deadline: deadline || '',
            brand: brand || '',
            series: series || ''
        };

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

        // 使用 Repository 创建订单（原子事务）
        await orderRepo.create({
            id: orderId,
            orderNo,
            salespersonId: salesperson.id,
            data: orderData,
            mainImageId,
            fileIds,
            timeline: {
                actionType: 'created',
                actorType: 'salesperson',
                actorId: salesperson.id,
                actorName: salesperson.name
            }
        });

        // 面向未来: 自动归档 (非事务，失败不影响订单创建)
        if (fileIds.length > 0) {
            try {
                const { ensureFolder, moveFilesToFolder } = await import('../../../utils/folder-utils.js');
                const rootId = await ensureFolder(env, 'Uploads', 'root');
                const subId = await ensureFolder(env, 'Orders', rootId);
                const folderId = await ensureFolder(env, orderNo, subId);
                await moveFilesToFolder(env, fileIds, folderId);
            } catch (e) {
                console.error('File archiving error:', e);
            }
        }

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

