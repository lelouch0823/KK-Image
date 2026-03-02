/**
 * 边缘缓存中间件
 * 使用 Cloudflare Cache API 缓存 GET 请求响应
 * 支持 ETag 条件请求
 */

import { sha256Hex } from '../../../_shared/utils.js';

export function withCache(ttlSeconds = 60) {
  return async (c, next) => {
    // 仅缓存 GET 请求
    if (c.req.method !== 'GET') {
      return next();
    }

    const cache = caches.default;
    const cacheKey = new Request(c.req.url, {
      method: 'GET',
      headers: { Accept: c.req.header('Accept') || 'application/json' },
    });

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
      const response = c.res.clone();
      const bodyText = await response.clone().text();

      // 生成 ETag（使用共享的哈希函数）
      const hashHex = await sha256Hex(bodyText);
      const etag = `"${hashHex.substring(0, 16)}"`;

      response.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
      response.headers.set('ETag', etag);
      response.headers.set('X-Cache', 'MISS');

      // 异步写入缓存
      c.executionCtx.waitUntil(cache.put(cacheKey, response));
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

  await Promise.all(urlArray.map((url) => cache.delete(new Request(url))));
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
