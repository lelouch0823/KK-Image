/**
 * 销售端鉴权 API
 * POST /api/order/:token/auth - 密码验证，返回 7 天 JWT
 * GET /api/order/:token/auth - 获取销售信息（需 JWT）
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { hashPassword, generateShareToken } from '../../utils/id.js';
import { generateJWT, verifyJWT } from '../../utils/auth.js';
import { parse as parseCookie } from 'cookie';

// Token 有效期：7 天
const TOKEN_EXPIRY = 7 * 24 * 60 * 60;

/**
 * POST - 密码验证登录
 */
export async function onRequestPost(context) {
    const { env, params, request } = context;
    const accessToken = params.token;

    try {
        const body = await request.json();
        const { password } = body;

        if (!password) {
            return error(MSG.SALESPERSON.PASSWORD_REQUIRED, 400);
        }

        // 查找销售人员
        const salesperson = await env.DB.prepare(`
            SELECT id, name, store, password_hash, is_active
            FROM salespersons WHERE access_token = ?
        `).bind(accessToken).first();

        if (!salesperson) {
            return error(MSG.SALESPERSON.NOT_FOUND, 404);
        }

        if (!salesperson.is_active) {
            return error(MSG.SALESPERSON.DISABLED, 403);
        }

        // 验证密码
        const inputHash = await hashPassword(password, env.JWT_SECRET);
        if (inputHash !== salesperson.password_hash) {
            return error(MSG.SALESPERSON.INVALID_PASSWORD, 401);
        }

        // 生成 JWT
        const jwt = await generateJWT({
            id: salesperson.id,
            name: salesperson.name,
            type: 'salesperson',
            permissions: ['order:read', 'order:write']
        }, env, TOKEN_EXPIRY);

        // 设置 Cookie
        const cookieOptions = [
            `sales_token=${jwt}`,
            `Path=/api/sales/${accessToken}`,
            `Max-Age=${TOKEN_EXPIRY}`,
            'HttpOnly',
            'SameSite=Lax'
        ];

        if (request.url.startsWith('https://')) {
            cookieOptions.push('Secure');
        }

        return success({
            id: salesperson.id,
            name: salesperson.name,
            store: salesperson.store
        }, MSG.AUTH.REQUIRED.replace('请先登录以访问此资源', '登录成功'), 200, {
            'Set-Cookie': cookieOptions.join('; ')
        });

    } catch (err) {
        console.error('Order auth error:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}

/**
 * GET - 获取当前销售信息（需 JWT）
 */
export async function onRequestGet(context) {
    const { env, params, request } = context;
    const accessToken = params.token;

    try {
        // 从 Cookie 获取 JWT
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = parseCookie(cookieHeader);
        const jwt = cookies.sales_token;

        if (!jwt) {
            return error(MSG.AUTH.REQUIRED, 401);
        }

        // 验证 JWT
        const payload = await verifyJWT(jwt, env);
        if (payload.type !== 'salesperson') {
            return error(MSG.AUTH.FORBIDDEN, 403);
        }

        // 获取销售信息
        const salesperson = await env.DB.prepare(`
            SELECT id, name, store, phone, is_active
            FROM salespersons WHERE id = ? AND access_token = ?
        `).bind(payload.id, accessToken).first();

        if (!salesperson) {
            return error(MSG.SALESPERSON.NOT_FOUND, 404);
        }

        if (!salesperson.is_active) {
            return error(MSG.SALESPERSON.DISABLED, 403);
        }

        return success({
            id: salesperson.id,
            name: salesperson.name,
            store: salesperson.store,
            phone: salesperson.phone
        });

    } catch (err) {
        if (err.message.includes('expired') || err.message.includes('Invalid')) {
            return error(MSG.AUTH.EXPIRED, 401);
        }
        console.error('Order auth check error:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
