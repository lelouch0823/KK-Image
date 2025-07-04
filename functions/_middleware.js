/**
 * 静态资源优化中间件
 * 处理压缩、缓存头和性能优化
 */

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 获取响应
  const response = await next();

  // 如果不是成功响应，直接返回
  if (!response.ok) {
    return response;
  }

  // 创建新的响应头
  const newHeaders = new Headers(response.headers);

  // 静态资源缓存策略
  if (isStaticAsset(pathname)) {
    // 长期缓存静态资源
    newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    
    // 启用压缩
    if (shouldCompress(pathname)) {
      newHeaders.set('Vary', 'Accept-Encoding');
    }
  } else if (isHTMLFile(pathname)) {
    // HTML 文件短期缓存
    newHeaders.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'DENY');
    newHeaders.set('X-XSS-Protection', '1; mode=block');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  } else if (isAPIRoute(pathname)) {
    // API 路由不缓存
    newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    newHeaders.set('Pragma', 'no-cache');
    newHeaders.set('Expires', '0');
  }

  // 安全头
  newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // CSP 头 - 适配 Vue 3 和 Element Plus
  const csp = [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://js.sentry-cdn.com https://static.hotjar.com https://www.clarity.ms",
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' https: data: blob:",
    "font-src 'self' https://unpkg.com data:",
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

/**
 * 判断是否为静态资源
 */
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.ico'];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

/**
 * 判断是否为 HTML 文件
 */
function isHTMLFile(pathname) {
  return pathname.endsWith('.html') || pathname === '/' || (!pathname.includes('.') && !pathname.startsWith('/api/'));
}

/**
 * 判断是否为 API 路由
 */
function isAPIRoute(pathname) {
  return pathname.startsWith('/api/');
}

/**
 * 判断是否应该压缩
 */
function shouldCompress(pathname) {
  const compressibleExtensions = ['.js', '.css', '.html', '.json', '.xml', '.svg'];
  return compressibleExtensions.some(ext => pathname.endsWith(ext));
}
