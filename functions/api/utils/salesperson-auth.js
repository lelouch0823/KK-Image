/**
 * 销售端鉴权工具
 * @module utils/salesperson-auth
 */

import { MSG } from './messages.js';
import { verifyJWT } from './auth.js';
import { parse as parseCookie } from 'cookie';

/**
 * 验证销售端 JWT 并返回销售信息
 * @param {Request} request - HTTP 请求对象
 * @param {Object} env - Cloudflare 环境绑定
 * @param {string} accessToken - 销售人员访问令牌
 * @returns {Promise<Object>} 销售人员信息
 * @throws {Error} 鉴权失败时抛出错误
 */
export async function authenticateSalesperson(request, env, accessToken) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookie(cookieHeader);
  let jwt = cookies.sales_token;

  // Fallback to Bearer JWT for non-cookie clients.
  if (!jwt) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      jwt = authHeader.substring(7);
    }
  }

  if (!jwt) {
    throw new Error(MSG.AUTH.REQUIRED);
  }

  const payload = await verifyJWT(jwt, env);
  if (payload.type !== 'salesperson') {
    throw new Error(MSG.AUTH.FORBIDDEN);
  }

  const salesperson = await env.DB.prepare(
    `
        SELECT id, name, store, is_active
        FROM salespersons WHERE id = ? AND access_token = ?
    `
  )
    .bind(payload.id, accessToken)
    .first();

  if (!salesperson) {
    throw new Error(MSG.SALESPERSON.NOT_FOUND);
  }

  if (!salesperson.is_active) {
    throw new Error(MSG.SALESPERSON.DISABLED);
  }

  return salesperson;
}
