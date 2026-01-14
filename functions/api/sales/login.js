/**
 * 销售人员用户名/密码登录 API (小程序专用)
 * POST /api/sales/login
 * 
 * 请求体: { username: string, password: string }
 * - username: 手机号或姓名
 * - password: 密码
 * 
 * 响应: { success: true, data: { id, name, store, token, accessToken } }
 */

import { success, error, MSG, verifyJWT, generateJWT } from '../../_shared/utils.js';

export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return error('请输入用户名和密码', 400);
        }

        // 查找销售人员 (通过手机号或姓名)
        const salesperson = await env.DB.prepare(`
      SELECT id, name, store, phone, access_token, password_hash, is_active
      FROM salespersons
      WHERE (phone = ? OR name = ?) AND is_active = 1
    `).bind(username.trim(), username.trim()).first();

        if (!salesperson) {
            console.log('Login failed: user not found for:', username);
            return error('用户不存在', 401);
        }

        // 验证密码 (SHA-256 哈希)
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        console.log('Login attempt:', { username, inputHash: passwordHash, storedHash: salesperson.password_hash });

        if (salesperson.password_hash !== passwordHash) {
            return error('密码错误', 401);
        }

        // 生成 JWT Token
        const token = await generateJWT(
            {
                id: salesperson.id,
                type: 'salesperson',
            },
            env, // 传递 env 对象，而不是 env.JWT_SECRET 字符串
            86400 * 7 // 7 天有效期
        );

        return success({
            id: salesperson.id,
            name: salesperson.name,
            store: salesperson.store,
            token: token,
            accessToken: salesperson.access_token, // 用于后续 API 调用
            expiresIn: 86400 * 7,
        });
    } catch (err) {
        console.error('Login error:', err);
        return error('登录失败: ' + err.message, 500);
    }
}
