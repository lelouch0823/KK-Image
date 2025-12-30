/**
 * Edge Middleware - SOTA JWT 验证 + Early Hints
 * 1. 在 Edge 层完成 JWT 验证，未授权用户无法看到任何 Admin HTML
 * 2. 为 HTML 页面发送 Early Hints 预加载关键资源
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

    // Token 有效，获取下游响应
    const response = await next();

    // 为 HTML 页面添加 Link 头（配合 Cloudflare Early Hints）
    if (pathname.endsWith('.html') || pathname === '/admin' || pathname === '/admin/') {
      const newResponse = new Response(response.body, response);
      // 预加载关键 CSS（Cloudflare 会自动转为 103 Early Hints）
      newResponse.headers.append('Link', '</assets/main.css>; rel=preload; as=style');
      return newResponse;
    }

    return response;
  } catch (error) {
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
