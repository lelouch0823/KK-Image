import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { LoginSchema, TokenSchema } from '../../schemas/user.js';
import { generateJWT, ADMIN_AUTH_COOKIE, verifyTurnstile, MSG } from '../../_shared/utils.js';
import {
  checkLoginLockout,
  recordLoginFailure,
  clearLoginFailures,
  loginRateLimitMiddleware,
  formatRetryAfter,
} from '../../middleware/rateLimit.js';

const app = new Hono();

/**
 * 生成锁定错误消息
 */
function getLockedMessage(retryAfter) {
  return MSG.AUTH.ACCOUNT_LOCKED.replace('{time}', formatRetryAfter(retryAfter));
}

/**
 * POST /api/v1/auth/login - 用户登录
 */
app.post('/login', loginRateLimitMiddleware, zValidator('json', LoginSchema), async (c) => {
  const { username, password, turnstileToken } = c.req.valid('json');
  const { env } = c;
  const kv = env.RATE_LIMIT_KV || env.KV;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

  // 检查是否被锁定
  const lockoutStatus = await checkLoginLockout(kv, ip, username);
  if (lockoutStatus.locked) {
    return c.json(
      {
        success: false,
        error: getLockedMessage(lockoutStatus.retryAfter),
        retryAfter: lockoutStatus.retryAfter,
      },
      429,
      { 'Retry-After': String(lockoutStatus.retryAfter) }
    );
  }

  // Turnstile 验证（如果配置）
  if (env.TURNSTILE_SECRET_KEY && turnstileToken) {
    const isValid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY);
    if (!isValid) {
      return c.json({ success: false, error: MSG.AUTH.VERIFY_FAILED }, 400);
    }
  }

  // 验证凭据
  if (!env.BASIC_USER || !env.BASIC_PASS) {
    return c.json({ success: false, error: MSG.AUTH.UNCONFIGURED }, 503);
  }

  // 1. Check Root Admin
  let authenticatedUser = null;
  if (username === env.BASIC_USER && password === env.BASIC_PASS) {
    authenticatedUser = { id: username, name: 'Administrator', type: 'admin', role: 'admin', permissions: ['admin:full'] };
  } else {
    // 2. 查询数据库用户（DB 故障时让错误冒泡到全局处理器）
    const dbUser = await env.DB.prepare('SELECT id, password_hash, name, role, permissions FROM users WHERE username = ?')
      .bind(username)
      .first();

    if (dbUser) {
      const { verifyPassword } = await import('../../_shared/utils.js');
      const isValid = await verifyPassword(password, dbUser.password_hash, env.JWT_SECRET);
      if (isValid) {
        authenticatedUser = {
          id: dbUser.id,
          name: dbUser.name,
          type: 'user',
          role: dbUser.role,
          permissions: dbUser.permissions ? JSON.parse(dbUser.permissions) : []
        };
      }
    }
  }

  if (!authenticatedUser) {
    // 记录登录失败
    const failureResult = await recordLoginFailure(kv, ip, username, c.executionCtx);

    const errorResponse = {
      success: false,
      error: MSG.AUTH.INVALID_CREDENTIALS,
      remaining: failureResult.remaining,
    };

    if (failureResult.locked) {
      errorResponse.error = getLockedMessage(failureResult.retryAfter);
      errorResponse.retryAfter = failureResult.retryAfter;
      return c.json(errorResponse, 429, { 'Retry-After': String(failureResult.retryAfter) });
    }

    return c.json(errorResponse, 401);
  }

  // 登录成功，清除失败记录
  await clearLoginFailures(kv, ip, username, c.executionCtx);

  // 生成 JWT
  const user = authenticatedUser;
  const expiresIn = 7 * 24 * 60 * 60; // 7 天
  const token = await generateJWT(user, env, expiresIn);

  // 设置 Cookie（本地开发时不使用 Secure）
  const isSecure = c.req.url.startsWith('https://');
  const cookie = `${ADMIN_AUTH_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${expiresIn}; SameSite=Lax${isSecure ? '; Secure' : ''}`;

  return c.json(
    {
      success: true,
      data: { user, expiresIn },
    },
    200,
    {
      'Set-Cookie': cookie,
    }
  );
});

/**
 * POST /api/v1/auth/token - 生成 API Token
 */
app.post('/token', loginRateLimitMiddleware, zValidator('json', TokenSchema), async (c) => {
  const { username, password, expiresIn } = c.req.valid('json');
  const { env } = c;
  const kv = env.RATE_LIMIT_KV || env.KV;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

  // 检查是否被锁定
  const lockoutStatus = await checkLoginLockout(kv, ip, username);
  if (lockoutStatus.locked) {
    return c.json(
      {
        success: false,
        error: getLockedMessage(lockoutStatus.retryAfter),
        retryAfter: lockoutStatus.retryAfter,
      },
      429,
      { 'Retry-After': String(lockoutStatus.retryAfter) }
    );
  }

  // 1. Check Root Admin
  let authenticatedUser = null;
  if (username === env.BASIC_USER && password === env.BASIC_PASS) {
    authenticatedUser = { id: username, name: 'Administrator', type: 'admin', role: 'admin', permissions: ['admin:full'] };
  } else {
    // 2. 查询数据库用户（DB 故障时让错误冒泡到全局处理器）
    const dbUser = await env.DB.prepare('SELECT id, password_hash, name, role, permissions FROM users WHERE username = ?')
      .bind(username)
      .first();

    if (dbUser) {
      const { verifyPassword } = await import('../../_shared/utils.js');
      const isValid = await verifyPassword(password, dbUser.password_hash, env.JWT_SECRET);
      if (isValid) {
        authenticatedUser = {
          id: dbUser.id,
          name: dbUser.name,
          type: 'user',
          role: dbUser.role,
          permissions: dbUser.permissions ? JSON.parse(dbUser.permissions) : []
        };
      }
    }
  }

  // 验证凭据失败
  if (!authenticatedUser) {
    // 记录登录失败
    const failureResult = await recordLoginFailure(kv, ip, username, c.executionCtx);

    if (failureResult.locked) {
      return c.json(
        {
          success: false,
          error: getLockedMessage(failureResult.retryAfter),
          retryAfter: failureResult.retryAfter,
        },
        429,
        { 'Retry-After': String(failureResult.retryAfter) }
      );
    }

    return c.json({ success: false, error: MSG.AUTH.INVALID_CREDENTIALS }, 401);
  }

  // 登录成功，清除失败记录
  await clearLoginFailures(kv, ip, username, c.executionCtx);

  const user = authenticatedUser;

  const token = await generateJWT(user, env, expiresIn);

  return c.json({
    success: true,
    data: {
      token,
      tokenType: 'Bearer',
      expiresIn,
      user: { id: user.id, name: user.name },
    },
  });
});

/**
 * POST /api/v1/auth/logout - 登出
 */
app.post('/logout', async (c) => {
  const isSecure = c.req.url.startsWith('https://');
  const cookie = `${ADMIN_AUTH_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isSecure ? '; Secure' : ''}`;

  return c.json(
    {
      success: true,
      message: 'Logged out successfully',
    },
    200,
    {
      'Set-Cookie': cookie,
    }
  );
});

/**
 * GET /api/v1/auth/check - 检查认证状态
 */
app.get('/check', async (c) => {
  const { env } = c;

  const isAuthConfigured = !!(env.BASIC_USER && env.BASIC_PASS);

  return c.json({
    success: true,
    data: {
      authEnabled: isAuthConfigured,
      message: isAuthConfigured ? 'Authentication is enabled' : MSG.AUTH.UNCONFIGURED,
    },
  });
});

/**
 * GET /api/v1/auth/me - 获取当前用户信息
 */
app.get('/me', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ success: false, error: MSG.AUTH.REQUIRED }, 401);
  }

  return c.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      type: user.type,
      role: user.role || 'admin', // Ensure role acts as a fallback or actual DB state
      permissions: user.permissions || [],
    },
  });
});

export default app;
