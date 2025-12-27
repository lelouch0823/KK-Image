// API v1 中间件 - 处理认证、CORS、错误处理等
import { verifyApiKey, verifyJWT } from '../utils/auth.js';
import { hasPermission, logPermissionCheck, requirePermission } from '../utils/permissions.js';
import { getUserById } from '../utils/users.js';
import { errorToResponse } from '../utils/errors.js';

// CORS 配置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
};

// 错误处理中间件
async function errorHandling(context) {
  try {
    return await context.next();
  } catch (err) {
    console.error('API Error:', err);
    // 使用新的错误处理辅助函数
    return errorToResponse(err, corsHeaders);
  }
}

// CORS 处理中间件
async function corsHandler(context) {
  // 处理 OPTIONS 预检请求
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const response = await context.next();

  // 为所有响应添加 CORS 头
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// API 认证中间件
async function apiAuthentication(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 跳过公开端点的认证
  const publicEndpoints = ['/api/v1/health', '/api/v1/info', '/api/v1/auth/token', '/api/v1/test', '/api/v1/simple-auth', '/api/v1/debug'];
  if (publicEndpoints.some(endpoint => url.pathname === endpoint || url.pathname.startsWith(endpoint + '/'))) {
    return context.next();
  }

  // 检查 API Key 或 JWT Token
  const apiKey = request.headers.get('X-API-Key');
  const authHeader = request.headers.get('Authorization');

  let authenticated = false;
  let user = null;

  // 优先检查 JWT Token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      user = await verifyJWT(token, env);

      // 获取完整用户信息，但保留 JWT 中的权限
      const fullUser = await getUserById(user.id, env);
      if (fullUser) {
        user = {
          ...user,      // JWT 基础信息 (iat, exp, type)
          ...fullUser,  // 数据库信息优先（覆盖 permissions 以确保安全）
          type: 'jwt'   // 确保 type 字段正确
        };
      }

      authenticated = true;
      logPermissionCheck(user, 'jwt_authentication', true, { endpoint: url.pathname });
    } catch (error) {
      console.log('JWT verification failed:', error.message);
      logPermissionCheck(null, 'jwt_authentication', false, { error: error.message });
    }
  }

  // 如果 JWT 验证失败，检查 API Key
  if (!authenticated && apiKey) {
    try {
      user = await verifyApiKey(apiKey, env);

      // 如果是用户 API Token，获取完整用户信息
      if (user.userId) {
        const fullUser = await getUserById(user.userId, env);
        if (fullUser) {
          user = {
            ...user,
            ...fullUser,
            type: 'user_token'
          };
        }
      }

      authenticated = true;
      logPermissionCheck(user, 'api_key_authentication', true, { endpoint: url.pathname });
    } catch (error) {
      console.log('API Key verification failed:', error.message);
      logPermissionCheck(null, 'api_key_authentication', false, { error: error.message });
    }
  }

  if (!authenticated) {
    const error = new Error('Authentication required');
    error.name = 'AuthenticationError';
    throw error;
  }

  // 将用户信息添加到上下文中 (使用 context.data 以确保持久化)
  if (!context.data) {
    context.data = {};
  }
  context.data.user = user;

  // 保持向后兼容（尽管似乎在 Pages 中无效）
  context.user = user;

  return context.next();
}

// 速率限制中间件
async function rateLimiting(context) {
  const { request, env } = context;

  if (!env.RATE_LIMIT_KV) {
    return context.next();
  }

  const clientIP = request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown';

  const key = `rate_limit:${clientIP}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1分钟窗口
  const maxRequests = 100; // 每分钟最多100个请求

  try {
    const existing = await env.RATE_LIMIT_KV.get(key, 'json');

    if (existing) {
      if (now - existing.timestamp < windowMs) {
        if (existing.count >= maxRequests) {
          const error = new Error('Rate limit exceeded');
          error.name = 'RateLimitError';
          throw error;
        }
        existing.count++;
      } else {
        existing.timestamp = now;
        existing.count = 1;
      }

      await env.RATE_LIMIT_KV.put(key, JSON.stringify(existing), {
        expirationTtl: Math.ceil(windowMs / 1000)
      });
    } else {
      await env.RATE_LIMIT_KV.put(key, JSON.stringify({
        timestamp: now,
        count: 1
      }), {
        expirationTtl: Math.ceil(windowMs / 1000)
      });
    }
  } catch (error) {
    console.error('Rate limiting error:', error);
    // 如果速率限制出错，继续处理请求
  }

  return context.next();
}

// 请求日志中间件
async function requestLogging(context) {
  const { request } = context;
  const startTime = Date.now();

  console.log(`[API] ${request.method} ${new URL(request.url).pathname}`);

  const response = await context.next();

  const duration = Date.now() - startTime;
  console.log(`[API] ${request.method} ${new URL(request.url).pathname} - ${response.status} (${duration}ms)`);

  return response;
}

// 导出中间件链
export const onRequest = [
  errorHandling,
  corsHandler,
  requestLogging,
  rateLimiting,
  apiAuthentication
];
