/**
 * 滑动窗口限流中间件
 * 使用 KV 存储请求计数
 */
export async function rateLimitMiddleware(c, next) {
  // 如果没有 KV 绑定，跳过限流
  if (!c.env.KV && !c.env.RATE_LIMIT_KV) {
    return next();
  }

  const kv = c.env.RATE_LIMIT_KV || c.env.KV;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
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
    // 限流失败不应阻止请求
    console.error('[RateLimit] Error:', err.message);
    return next();
  }
}

/**
 * 自定义限流规则工厂
 * @param {Object} options - 配置选项
 */
export function rateLimit(options = {}) {
  const { window = 60000, max = 100, keyPrefix = 'ratelimit' } = options;

  return async (c, next) => {
    const kv = c.env.RATE_LIMIT_KV || c.env.KV;
    if (!kv) return next();

    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const windowKey = Math.floor(Date.now() / window);
    const key = `${keyPrefix}:${ip}:${windowKey}`;

    const current = parseInt((await kv.get(key)) || '0');

    if (current >= max) {
      return c.json({ success: false, error: 'Rate limit exceeded' }, 429);
    }

    c.executionCtx.waitUntil(
      kv.put(key, String(current + 1), { expirationTtl: Math.ceil(window / 1000) * 2 })
    );

    return next();
  };
}
