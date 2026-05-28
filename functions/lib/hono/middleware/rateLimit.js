function getRateLimitKv(env = {}) {
  return env.RATE_LIMIT_KV || env.KV || null;
}

function isLoopbackHostname(hostname = '') {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized === '127.0.0.1' || normalized === 'localhost';
}

export function resolveRequestIp(req) {
  const forwardedIp = req?.header?.('X-Forwarded-For') || '';
  const cfIp = req?.header?.('CF-Connecting-IP') || '';

  try {
    const url = new URL(req?.url || '');
    if (isLoopbackHostname(url.hostname) && forwardedIp) {
      return forwardedIp.split(',')[0].trim();
    }
  } catch {
    // fall through to header priority fallback
  }

  return cfIp || forwardedIp.split(',')[0].trim() || 'unknown';
}

function shouldBypassGlobalRateLimit(c) {
  const bypassHeader = c.req.header('X-Test-Bypass-RateLimit');
  if (String(bypassHeader || '').trim() !== '1') return false;

  // 生产环境禁止通过 header 旁路限流
  if (c.env?.ENVIRONMENT === 'production') return false;

  try {
    const url = new URL(c.req.url);
    return isLoopbackHostname(url.hostname);
  } catch {
    return false;
  }
}

function rateLimitUnavailableResponse(c) {
  return c.json(
    {
      success: false,
      error: 'Rate limit service unavailable.',
    },
    503
  );
}

/**
 * 滑动窗口限流中间件
 * 使用 KV 存储请求计数
 */
export async function rateLimitMiddleware(c, next) {
  if (shouldBypassGlobalRateLimit(c)) {
    return next();
  }

  const kv = getRateLimitKv(c.env);
  if (!kv) {
    // KV 不可用时放行请求（降级策略）
    return next();
  }
  const ip = resolveRequestIp(c.req);
  const windowMs = 60000; // 1 分钟窗口
  const maxRequests = 100; // 每窗口最大请求数

  const windowKey = Math.floor(Date.now() / windowMs);
  const key = `ratelimit:${ip}:${windowKey}`;

  try {
    const current = parseInt((await kv.get(key)) || '0');

    if (current >= maxRequests) {
      const retryAfter = Math.ceil((windowMs - (Date.now() % windowMs)) / 1000);

      return c.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter,
        },
        429,
        {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
        }
      );
    }

    // 异步更新计数（不阻塞请求）
    c.executionCtx.waitUntil(kv.put(key, String(current + 1), { expirationTtl: 120 }));

    // 添加限流信息头
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(maxRequests - current - 1));

    return next();
  } catch (err) {
    console.error('[RateLimit] Error:', err.message);
    return rateLimitUnavailableResponse(c);
  }
}

/**
 * 自定义限流规则工厂
 * @param {Object} options - 配置选项
 */
export function rateLimit(options = {}) {
  const { window = 60000, max = 100, keyPrefix = 'ratelimit' } = options;

  return async (c, next) => {
    const kv = getRateLimitKv(c.env);
    if (!kv) return next(); // KV 不可用时放行

    const ip = resolveRequestIp(c.req);
    const windowKey = Math.floor(Date.now() / window);
    const key = `${keyPrefix}:${ip}:${windowKey}`;

    const current = parseInt((await kv.get(key)) || '0');

    if (current >= max) {
      return c.json({ success: false, error: 'Rate limit exceeded' }, 429);
    }

    try {
      c.executionCtx.waitUntil(
        kv.put(key, String(current + 1), { expirationTtl: Math.ceil(window / 1000) * 2 })
      );

      return next();
    } catch (err) {
      console.error('[RateLimit] Error:', err.message);
      return rateLimitUnavailableResponse(c);
    }
  };
}

/**
 * 登录失败次数限制中间件
 * 防止暴力破解攻击
 *
 * 规则：
 * - 5 次失败后锁定 15 分钟
 * - 基于 IP + 用户名组合
 */
export const LOGIN_LOCKOUT_CONFIG = {
  maxAttempts: 5,           // 最大失败次数
  lockoutDuration: 15 * 60, // 锁定时间（秒）
  windowDuration: 15 * 60,  // 失败计数窗口（秒）
};

/**
 * 检查登录是否被锁定
 * @param {Object} kv - KV 存储
 * @param {string} ip - 客户端 IP
 * @param {string} username - 用户名
 * @returns {Promise<{locked: boolean, remaining: number, retryAfter: number}>}
 */
export async function checkLoginLockout(kv, ip, username) {
  if (!kv) return { locked: false, unavailable: true, remaining: 0, retryAfter: 0 };

  const key = `login_lockout:${ip}:${username || 'unknown'}`;

  try {
    const data = await kv.get(key, { type: 'json' });

    if (!data) {
      return { locked: false, remaining: LOGIN_LOCKOUT_CONFIG.maxAttempts, retryAfter: 0 };
    }

    const { attempts, lockedUntil } = data;
    const now = Date.now();

    // 检查是否仍在锁定期
    if (lockedUntil && now < lockedUntil) {
      const retryAfter = Math.ceil((lockedUntil - now) / 1000);
      return { locked: true, remaining: 0, retryAfter };
    }

    // 锁定期已过，重置
    if (lockedUntil && now >= lockedUntil) {
      return { locked: false, remaining: LOGIN_LOCKOUT_CONFIG.maxAttempts, retryAfter: 0 };
    }

    const remaining = Math.max(0, LOGIN_LOCKOUT_CONFIG.maxAttempts - attempts);
    return { locked: false, remaining, retryAfter: 0 };
  } catch (err) {
    console.error('[LoginLockout] Check error:', err.message);
    return { locked: false, unavailable: true, remaining: 0, retryAfter: 0 };
  }
}

/**
 * 记录登录失败
 * @param {Object} kv - KV 存储
 * @param {string} ip - 客户端 IP
 * @param {string} username - 用户名
 * @param {Object} executionCtx - 执行上下文（用于 waitUntil）
 * @returns {Promise<{locked: boolean, remaining: number, retryAfter: number}>}
 */
export async function recordLoginFailure(kv, ip, username, executionCtx) {
  if (!kv) return { locked: false, unavailable: true, remaining: 0, retryAfter: 0 };

  const key = `login_lockout:${ip}:${username || 'unknown'}`;

  try {
    const data = await kv.get(key, { type: 'json' });
    const now = Date.now();

    let attempts = 1;
    let lockedUntil = null;

    if (data) {
      // 如果之前的锁定已过期，重新开始计数
      if (data.lockedUntil && now >= data.lockedUntil) {
        attempts = 1;
      } else {
        attempts = (data.attempts || 0) + 1;
      }
    }

    // 达到最大失败次数，锁定账户
    if (attempts >= LOGIN_LOCKOUT_CONFIG.maxAttempts) {
      lockedUntil = now + LOGIN_LOCKOUT_CONFIG.lockoutDuration * 1000;
    }

    const newData = { attempts, lockedUntil, lastAttempt: now };

    // 异步保存（不阻塞响应）
    const savePromise = kv.put(key, JSON.stringify(newData), {
      expirationTtl: LOGIN_LOCKOUT_CONFIG.windowDuration + 60, // 额外 60 秒缓冲
    });

    if (executionCtx?.waitUntil) {
      executionCtx.waitUntil(savePromise);
    } else {
      await savePromise;
    }

    if (lockedUntil) {
      return {
        locked: true,
        remaining: 0,
        retryAfter: LOGIN_LOCKOUT_CONFIG.lockoutDuration,
      };
    }

    return {
      locked: false,
      remaining: LOGIN_LOCKOUT_CONFIG.maxAttempts - attempts,
      retryAfter: 0,
    };
  } catch (err) {
    console.error('[LoginLockout] Record error:', err.message);
    return { locked: false, unavailable: true, remaining: 0, retryAfter: 0 };
  }
}

/**
 * 清除登录失败记录（登录成功时调用）
 * @param {Object} kv - KV 存储
 * @param {string} ip - 客户端 IP
 * @param {string} username - 用户名
 * @param {Object} executionCtx - 执行上下文
 */
export async function clearLoginFailures(kv, ip, username, executionCtx) {
  if (!kv) return;

  const key = `login_lockout:${ip}:${username || 'unknown'}`;

  try {
    const deletePromise = kv.delete(key);

    if (executionCtx?.waitUntil) {
      executionCtx.waitUntil(deletePromise);
    } else {
      await deletePromise;
    }
  } catch (err) {
    console.error('[LoginLockout] Clear error:', err.message);
  }
}

/**
 * 登录端点专用严格限流中间件
 * 每分钟最多 10 次登录尝试（基于 IP）
 */
export function loginRateLimitMiddleware(c, next) {
  return rateLimit({
    window: 60000,     // 1 分钟
    max: 10,           // 最多 10 次
    keyPrefix: 'login_rate',
  })(c, next);
}

/**
 * 格式化剩余时间为友好文本
 * @param {number} seconds - 剩余秒数
 * @returns {string} 格式化后的时间文本
 */
export function formatRetryAfter(seconds) {
  if (seconds <= 0) return '现在';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `${hours}小时${remainingMinutes}分钟`;
    }
    return `${hours}小时`;
  }

  if (minutes > 0) {
    if (remainingSeconds > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${minutes}分钟`;
  }

  return `${seconds}秒`;
}
