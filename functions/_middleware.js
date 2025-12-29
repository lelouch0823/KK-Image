/**
 * Edge Middleware - SOTA JWT 验证
 * 在 Edge 层完成 JWT 验证，未授权用户无法看到任何 Admin HTML
 */

import { verifyJWT, ADMIN_AUTH_COOKIE } from './api/utils/auth.js';

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // API 路由由 Hono 处理，跳过此中间件
  if (pathname.startsWith('/api/')) {
    return next();
  }

  // 只保护 admin 相关页面
  const isAdminPath = pathname.includes('admin');
  if (!isAdminPath) {
    return next();
  }

  // 从 Cookie 中提取 JWT Token
  const cookieHeader = request.headers.get('Cookie') || '';
  const regex = new RegExp(`${ADMIN_AUTH_COOKIE}=([^;]+)`);
  const match = cookieHeader.match(regex);

  if (!match) {
    return Response.redirect(`${url.origin}/login.html`, 302);
  }

  // 验证 JWT（复用 auth.js 的函数）
  try {
    await verifyJWT(match[1], env);
    // Token 有效，允许访问
    return next();
  } catch (error) {
    // console.log(`[Edge Auth] Invalid/expired token for ${pathname}: ${error.message}`);
    // Token valid check failed, clear cookie
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}/login.html`,
        'Set-Cookie': `${ADMIN_AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
      }
    });
  }
}
