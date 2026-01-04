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

  // Try Bearer token if no cookie
  if (!jwt) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // For sales, we might need a way to distinguish if the Bearer is the JWT or just the "token" part of the URL path.
      // However, usually "accessToken" (the path param) is not the JWT. 
      // The JWT is strictly for session. 
      // Wait, let's look at how authenticateSalesperson is called. 
      // It takes `accessToken` as an argument (from URL path usually). 
      // If we want external API access, maybe we should rely purely on the JWT?

      // Let's look at the implementation plan again.
      // "Sales: URL Path Token (/api/sales/:token/...)"
      // "Support Bearer Token"

      // If we use Bearer token, we probably mean the JWT returned after "login"? 
      // Or is `accessToken` something else?
      // In `authenticateSalesperson`, it checks `sales_token` cookie (JWT).
      // AND it checks `accessToken` (from path) against DB `access_token` column.

      // If an external app uses the API, it might not want to put the token in the URL path for every request if possible,
      // OR it still has to because the route is `functions/api/sales/[token]/...`.
      // The current route structure forces `[token]` in the URL.

      // So the Bearer token here is likely the JWT (sales_token).

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
