/**
 * 微信小程序一键登录 API
 * POST /api/sales/wechat-login
 *
 * 流程:
 * 1. 小程序调用 wx.login() 获取 code
 * 2. 发送 code 到此接口
 * 3. 后端调用微信 code2Session 获取 openid
 * 4. 查询 salespersons 表是否有绑定该 openid 的销售
 * 5. 若有，生成 JWT 返回；若无，返回 needBind: true
 */

import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';
import { generateJWT } from '../utils/auth.js';
import { SalespersonRepository } from '../../repositories/SalespersonRepository.js';

// Token 有效期：7 天
const TOKEN_EXPIRY = 7 * 24 * 60 * 60;

/**
 * 调用微信 auth.code2Session 接口
 * @param {string} code - wx.login 返回的 code
 * @param {Object} env - 环境变量
 * @returns {Promise<{openid: string, session_key: string, unionid?: string}>}
 */
async function code2Session(code, env) {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WECHAT_APPID}&secret=${env.WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode) {
        throw new Error(`微信登录失败: ${data.errmsg} (${data.errcode})`);
    }

    return data;
}

export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        // 检查微信配置
        if (!env.WECHAT_APPID || !env.WECHAT_SECRET) {
            return error('微信登录未配置，请联系管理员', 503);
        }

        const body = await request.json();
        const { code } = body;

        if (!code) {
            return error('缺少微信登录 code', 400);
        }

        // 调用微信接口获取 openid
        const wxSession = await code2Session(code, env);
        const { openid } = wxSession;

        // 查询是否有绑定该 openid 的销售
        const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
        const salesperson = await repo.findByWechatOpenid(openid);

        if (!salesperson) {
            // 未绑定，返回 needBind 状态
            return success({
                needBind: true,
                openid, // 前端需要保存，用于后续绑定
            });
        }

        if (!salesperson.is_active) {
            return error(MSG.SALESPERSON.DISABLED, 403);
        }

        // 生成 JWT
        const jwt = await generateJWT(
            {
                id: salesperson.id,
                name: salesperson.name,
                type: 'salesperson',
                permissions: ['order:read', 'order:write'],
            },
            env,
            TOKEN_EXPIRY
        );

        return success({
            token: jwt,
            expiresIn: TOKEN_EXPIRY,
            user: {
                id: salesperson.id,
                name: salesperson.name,
                store: salesperson.store,
            },
        });
    } catch (err) {
        console.error('WeChat login error:', err);
        return error(`微信登录失败: ${err.message}`, 500);
    }
}
