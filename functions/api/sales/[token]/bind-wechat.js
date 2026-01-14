/**
 * 微信绑定 API
 * POST /api/sales/:token/bind-wechat
 *
 * 用于已有销售账号绑定微信，需先通过密码登录获取 JWT
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { verifyJWT } from '../../utils/auth.js';
import { SalespersonRepository } from '../../../repositories/SalespersonRepository.js';

/**
 * 调用微信 auth.code2Session 接口
 */
async function code2Session(code, env) {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WECHAT_APPID}&secret=${env.WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode) {
        throw new Error(`微信验证失败: ${data.errmsg} (${data.errcode})`);
    }

    return data;
}

export async function onRequestPost(context) {
    const { env, params, request } = context;
    const accessToken = params.token;

    try {
        // 检查微信配置
        if (!env.WECHAT_APPID || !env.WECHAT_SECRET) {
            return error('微信功能未配置', 503);
        }

        // 验证 JWT (需要先登录)
        let jwt = null;
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            jwt = authHeader.substring(7);
        }

        if (!jwt) {
            return error(MSG.AUTH.REQUIRED, 401);
        }

        const payload = await verifyJWT(jwt, env);
        if (payload.type !== 'salesperson') {
            return error(MSG.AUTH.FORBIDDEN, 403);
        }

        // 获取请求体
        const body = await request.json();
        const { code } = body;

        if (!code) {
            return error('缺少微信 code', 400);
        }

        // 调用微信接口获取 openid
        const wxSession = await code2Session(code, env);
        const { openid } = wxSession;

        // 检查 openid 是否已被其他账号绑定
        const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
        const existingUser = await repo.findByWechatOpenid(openid);
        if (existingUser && existingUser.id !== payload.id) {
            return error('该微信已绑定其他账号', 400);
        }

        // 验证 access_token 匹配
        const salesperson = await repo.findByToken(accessToken);
        if (!salesperson || salesperson.id !== payload.id) {
            return error(MSG.SALESPERSON.NOT_FOUND, 404);
        }

        // 绑定 openid
        await repo.updateWechatOpenid(payload.id, openid);

        return success({
            message: '微信绑定成功',
        });
    } catch (err) {
        console.error('Bind WeChat error:', err);
        if (err.message.includes('expired') || err.message.includes('Invalid')) {
            return error(MSG.AUTH.EXPIRED, 401);
        }
        return error(`绑定失败: ${err.message}`, 500);
    }
}
