import { sentryPagesPlugin } from '@sentry/cloudflare';
import { verifyJWT, ADMIN_AUTH_COOKIE } from './api/utils/auth.js';

/**
 * Edge Middleware - 组合 Sentry 监控 + JWT 验证
 */
export const onRequest = [
  // 1. Sentry Monitoring with optimized config
  sentryPagesPlugin((context) => ({
    dsn: context.env.SENTRY_DSN,
    tracesSampleRate: Number(context.env.SENTRY_TRACES_SAMPLE_RATE || 0.2), // Default 20% sampling
    environment: context.env.ENVIRONMENT || 'production',
    attachStacktrace: true,
  })),

  // 2. JWT 验证与重定向
  async (context) => {
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
      return Response.redirect(`${url.origin}/login`, 302);
    }

    // 验证 JWT
    try {
      await verifyJWT(match[1], env);
      return next();
    } catch (_error) {
      // Token valid check failed, clear cookie
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${url.origin}/login`,
          'Set-Cookie': `${ADMIN_AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
        },
      });
    }
  }
];
