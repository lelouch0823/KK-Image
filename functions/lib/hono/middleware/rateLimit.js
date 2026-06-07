function getRateLimitKv(env = {}) {
  return env.RATE_LIMIT_KV || env.KV || null;
}

function isLoopbackHostname(hostname = '') {
  const normalized = String(hostname || '')
    .trim()
    .toLowerCase();
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

  // 默认环境视为生产环境（安全默认值），禁止通过 header 旁路限流
  const isProd = (c.env?.ENVIRONMENT || 'production') === 'production';
  if (isProd) return false;

  try {
    const url = new URL(c.req.url);
    return isLoopbackHostname(url.hostname);
  } catch {
    return false;
  }
}

/**
 * 模块级内存滑动窗口计数器
 * 优先使用内存计数（零延迟），定期异步同步到 KV（跨 isolate 持久化）
 * @type {Map<string, { count: number, lastSync: number }>}
 */
const memoryCounters = new Map();
const SYNC_INTERVAL_MS = 10_000; // 每 10 秒同步一次到 KV
const MEMORY_TTL_MS = 120_000; // 内存条目 2 分钟后过期
const MAX_MEMORY_ENTRIES = 5000; // 内存条目硬上限，防止无界增长

function cleanupExpiredEntries(now) {
  for (const [key, entry] of memoryCounters) {
    if (now - entry.lastSync > MEMORY_TTL_MS) {
      memoryCounters.delete(key);
    }
  }
}

/**
 * 滑动窗口限流中间件
 * 内存优先 + 异步 KV 同步，消除每个请求的 KV 阻塞读取
 */
export async function rateLimitMiddleware(c, next) {
  if (shouldBypassGlobalRateLimit(c)) {
    return next();
  }

  const kv = getRateLimitKv(c.env);
  const ip = resolveRequestIp(c.req);
  const windowMs = 60000; // 1 分钟窗口
  const maxRequests = 100; // 每窗口最大请求数
  const now = Date.now();
  const windowKey = Math.floor(now / windowMs);
  const key = `ratelimit:${ip}:${windowKey}`;

  // 1. 内存快速检查（无网络往返，<0.01ms）
  let entry = memoryCounters.get(key);
  if (!entry) {
    // 超过硬上限时强制清理，拒绝新条目
    if (memoryCounters.size >= MAX_MEMORY_ENTRIES) {
      cleanupExpiredEntries(now);
      // 清理后仍然超限，拒绝新条目（降级到 KV 查询）
      if (memoryCounters.size >= MAX_MEMORY_ENTRIES) {
        console.warn(`[RateLimit] Memory map full (${memoryCounters.size}), falling back to KV`);
        if (kv) {
          const kvCount = parseInt((await kv.get(key)) || '0', 10);
          if (kvCount >= maxRequests) {
            const retryAfter = Math.ceil((windowMs - (now % windowMs)) / 1000);
            return c.json({ success: false, error: 'Rate limit exceeded', retryAfter }, 429, {
              'Retry-After': String(retryAfter),
            });
          }
          await kv.put(key, String(kvCount + 1), { expirationTtl: 120 });
        }
        return next();
      }
    }
    entry = { count: 0, lastSync: 0 };
    memoryCounters.set(key, entry);
  }

  // 2. 惰性清理过期窗口
  if (memoryCounters.size > 1000) {
    cleanupExpiredEntries(now);
  }

  // 3. 跨 isolate 合并：首次遇到 key 或定期从 KV 读取其他 isolate 的计数
  //    确保全局限流在多 isolate 场景下仍然有效
  const needsKVMerge = kv && (entry.lastSync === 0 || now - entry.lastSync > SYNC_INTERVAL_MS);
  if (needsKVMerge) {
    try {
      const kvCount = parseInt((await kv.get(key)) || '0', 10);
      // 取本地计数和 KV 计数的较大值，防止其他 isolate 的请求被忽略
      if (kvCount > entry.count) {
        entry.count = kvCount;
      }
    } catch (err) {
      console.error('[RateLimit] KV read error:', err.message);
    }
  }

  // 4. 检查限制
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((windowMs - (now % windowMs)) / 1000);
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
        'X-RateLimit-Reset': String(Math.ceil(now / 1000) + retryAfter),
      }
    );
  }

  // 5. 内存递增（立即生效，零延迟）
  entry.count++;

  // 6. 异步同步到 KV（不阻塞请求，定期同步减少 KV 写入）
  if (kv && now - entry.lastSync > SYNC_INTERVAL_MS) {
    entry.lastSync = now;
    c.executionCtx.waitUntil(
      kv.put(key, String(entry.count), { expirationTtl: 120 }).catch((err) => {
        console.error('[RateLimit] KV sync error:', err.message);
      })
    );
  }

  // 6. 添加限流信息头
  c.header('X-RateLimit-Limit', String(maxRequests));
  c.header('X-RateLimit-Remaining', String(maxRequests - entry.count));

  return next();
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

    const current = parseInt((await kv.get(key)) || '0', 10);

    if (current >= max) {
      return c.json({ success: false, error: 'Rate limit exceeded' }, 429);
    }

    try {
      c.executionCtx.waitUntil(
        kv.put(key, String(current + 1), { expirationTtl: Math.ceil(window / 1000) * 2 })
      );

      return next();
    } catch (err) {
      // KV 故障时降级放行
      console.error('[RateLimit] Error:', err.message);
      return next();
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
  maxAttempts: 5, // 最大失败次数
  lockoutDuration: 15 * 60, // 锁定时间（秒）
  windowDuration: 15 * 60, // 失败计数窗口（秒）
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
    window: 60000, // 1 分钟
    max: 10, // 最多 10 次
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

/**
 * 测试辅助：清理模块级内存计数器
 * 仅用于单元测试，生产环境不应调用
 */
export function _resetMemoryCountersForTest() {
  memoryCounters.clear();
}
