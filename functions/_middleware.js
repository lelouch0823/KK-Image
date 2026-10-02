import { sentryPagesPlugin } from '@sentry/cloudflare';
import { isAdminAuthenticated, ADMIN_AUTH_COOKIE } from './api/utils/auth.js';

/**
 * Edge Middleware - 组合 Sentry 监控 + JWT 验证
 */
export const onRequest = [
  // 1. Sentry Monitoring with optimized config
  sentryPagesPlugin((context) => ({
    dsn: context.env.SENTRY_DSN,
    tracesSampleRate: Number(context.env.SENTRY_TRACES_SAMPLE_RATE || 0.05), // Default 5% sampling
    // 未配置 ENVIRONMENT 时使用 'unknown'，避免误报为生产环境
    environment: context.env.ENVIRONMENT || 'unknown',
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

    // 只保护 admin 相关页面（使用精确路径匹配）
    const isAdminPath = pathname.startsWith('/admin') || pathname === '/admin.html';
    if (!isAdminPath) {
      return next();
    }

    // 验证 JWT（isAdminAuthenticated 同时校验令牌类型，防止销售端/分享令牌进入管理后台）
    const isAdmin = await isAdminAuthenticated(request, env);
    if (isAdmin) {
      return next();
    }
    // Token 校验失败，清除 Cookie 并重定向到登录页
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${url.origin}/login`,
        'Set-Cookie': `${ADMIN_AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
      },
    });
  },
];
