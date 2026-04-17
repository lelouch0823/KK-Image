/**
 * 边缘缓存中间件
 * 使用 Cloudflare Cache API 缓存 GET 请求响应
 * 支持 ETag 条件请求
 */

import { sha256Hex } from '../../../_shared/utils.js';

function normalizeCacheUrl(url) {
  const normalized = new URL(url);
  if (normalized.hostname === '127.0.0.1') {
    normalized.hostname = 'localhost';
  }
  if (normalized.hostname === 'localhost' && !normalized.port && normalized.protocol === 'http:') {
    normalized.port = '8080';
  }
  normalized.searchParams.sort();
  return normalized.toString();
}

function normalizeAcceptHeader(accept) {
  const normalized = String(accept || '').trim();
  if (!normalized || normalized === '*/*') {
    return 'application/json';
  }
  return normalized;
}

function createCacheRequest(url, accept = 'application/json') {
  return new Request(normalizeCacheUrl(url), {
    method: 'GET',
    headers: { Accept: normalizeAcceptHeader(accept) },
  });
}

export function withCache(ttlSeconds = 60, options = {}) {
  const { etagMode = 'off' } = options;

  return async (c, next) => {
    // 仅缓存 GET 请求
    if (c.req.method !== 'GET') {
      return next();
    }

    const cache = caches.default;
    const cacheKey = createCacheRequest(c.req.url, c.req.header('Accept'));

    // 尝试从缓存获取
    const cached = await cache.match(cacheKey);
    if (cached) {
      // 检查 If-None-Match（条件请求）
      const cachedEtag = cached.headers.get('ETag');
      const ifNoneMatch = c.req.header('If-None-Match');
      if (cachedEtag && ifNoneMatch && ifNoneMatch === cachedEtag) {
        return new Response(null, {
          status: 304,
          headers: { ETag: cachedEtag, 'X-Cache': 'HIT' },
        });
      }
      // 添加缓存命中标记
      const response = new Response(cached.body, cached);
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    // 执行下游处理
    await next();

    // 仅缓存成功响应
    if (c.res && c.res.ok) {
      c.res.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
      c.res.headers.set('X-Cache', 'MISS');

      if (etagMode === 'body-hash') {
        const bodyText = await c.res.clone().text();
        const hashHex = await sha256Hex(bodyText);
        c.res.headers.set('ETag', `"${hashHex.substring(0, 16)}"`);
      }

      // 保持原始响应对象作为最终返回值，仅克隆一份用于异步写缓存，
      // 避免在 Hono app.request() 场景下返回不可再次读取的 body。
      c.executionCtx.waitUntil(cache.put(cacheKey, c.res.clone()));
    }
  };
}

/**
 * 缓存失效工具
 * @param {string|string[]} urls - 要失效的 URL 或 URL 数组
 */
export async function invalidateCache(urls) {
  const cache = caches.default;
  const urlArray = Array.isArray(urls) ? urls : [urls];

  await Promise.all(urlArray.flatMap((url) => ([
    cache.delete(createCacheRequest(url)),
    cache.delete(createCacheRequest(url, '*/*')),
  ])));
}

/**
 * 获取商品相关的缓存 URL 列表
 * @param {Object} c - Hono context
 * @returns {string[]}
 */
export function getProductCacheUrls(c) {
  const baseUrl = new URL(c.req.url).origin;
  return [
    `${baseUrl}/api/manage/products`,
    `${baseUrl}/api/manage/products?page=1&limit=20`,
    `${baseUrl}/api/manage/products/variants`,
    `${baseUrl}/api/manage/products/variants?page=1&limit=50`,
    `${baseUrl}/api/manage/products/variants?search=&page=1&limit=50`,
  ];
}

/**
 * 条件缓存中间件
 * 基于用户身份或其他条件决定是否缓存
 */
export function conditionalCache(options = {}) {
  const { ttl = 60, condition = () => true, varyBy = [] } = options;

  return async (c, next) => {
    if (c.req.method !== 'GET' || !condition(c)) {
      return next();
    }

    // 构建包含 vary 参数的缓存键
    const varyParams = varyBy.map((key) => `${key}=${c.req.query(key) || ''}`).join('&');
    const cacheUrl = varyParams ? `${c.req.url}?_vary=${varyParams}` : c.req.url;

    const cache = caches.default;
    const cacheKey = new Request(cacheUrl);

    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    await next();

    if (c.res?.ok) {
      const response = c.res.clone();
      response.headers.set('Cache-Control', `public, max-age=${ttl}`);
      c.executionCtx.waitUntil(cache.put(cacheKey, response));
    }
  };
}
