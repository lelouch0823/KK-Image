/**
 * 中间件 - 认证和 API 响应头
 * 静态资源头现在由 _headers 文件处理
 */

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. 认证重定向逻辑 (Edge Auth)
  // 如果是管理页面相关的 HTML 请求，检查 Cookie
  const isHtmlRequest = pathname.endsWith('.html') || pathname === '/' || !pathname.includes('.');
  const isAdminPath = pathname.includes('admin');

  if (isHtmlRequest && isAdminPath) {
    const cookieHeader = request.headers.get('Cookie');
    const hasToken = cookieHeader && cookieHeader.includes('TELEG_AUTH=');

    // 如果没有 Token，重定向到登录页
    if (!hasToken) {
      console.log(`[Edge Auth] Redirecting unauthenticated request for ${pathname} to /login.html`);
      return Response.redirect(`${url.origin}/login.html`, 302);
    }
  }

  // 获取响应
  const response = await next();

  // 如果不是成功响应或不是 API 路由，直接返回（静态资源头由 _headers 处理）
  if (!response.ok || !pathname.startsWith('/api/')) {
    return response;
  }

  // 仅为 API 路由设置响应头
  const newHeaders = new Headers(response.headers);

  // API 路由不缓存
  newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  newHeaders.set('Pragma', 'no-cache');
  newHeaders.set('Expires', '0');

  // CSP 头 - 适配 Vue 3
  const csp = [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://unpkg.com https://js.sentry-cdn.com https://browser.sentry-cdn.com https://cdn.tailwindcss.com https://static.hotjar.com https://www.clarity.ms https://cdn.jsdelivr.net",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
    "img-src 'self' https: data: blob:",
    "font-src 'self' https://unpkg.com https://fonts.gstatic.com data:",
    "connect-src 'self' https:",
    "media-src 'self' https: data: blob:"
  ].join('; ');

  newHeaders.set('Content-Security-Policy', csp);

  // 创建新响应
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
