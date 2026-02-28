/**
 * @fileoverview 文件访问处理 (带 Cache API 优化)
 * @module file/[id]
 *
 * 基于 D1 数据库的文件服务：
 * - 从 D1 查询文件信息
 * - 使用 Cache API 缓存 R2 响应 (减少 Class B 操作)
 * - 设置适当的缓存控制头
 */

export async function onRequest(context) {
  const { request, env, params } = context;
  const fileId = params.id;

  // 1. 尝试从 Cache 获取
  const cache = caches.default;
  const cacheKey = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
  });

  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    // 添加 Cache 命中标记
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Cache', 'HIT');
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      headers,
    });
  }

  // 2. Cache 未命中，从 D1 查询文件信息
  let fileRecord = null;
  if (env.DB) {
    try {
      fileRecord = await env.DB.prepare('SELECT * FROM files WHERE storage_key = ? OR id = ?')
        .bind(fileId, fileId)
        .first();
    } catch (err) {
      console.error('D1 query error:', err);
      return new Response('Database error', { status: 500 });
    }
  }

  // 确定要查找的 key
  const storageKey = fileRecord?.storage_key || fileId;

  // 3.1 外链图片：直接代理（用于 seed/外部图床场景）
  if (/^https?:\/\//i.test(storageKey)) {
    try {
      // 构建请求头，防止被外部服务器（如 Cloudflare/Pexels）拦截导致断网 (internal error)
      const fetchHeaders = new Headers();
      const userAgent = request.headers.get('User-Agent');
      fetchHeaders.set('User-Agent', userAgent || 'KK-Image/1.0 (Cloudflare Worker)');
      fetchHeaders.set('Accept', request.headers.get('Accept') || 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8');

      const upstream = await fetch(storageKey, { 
        method: 'GET',
        headers: fetchHeaders,
        redirect: 'follow'
      });
      
      if (!upstream.ok) {
        console.warn(`获取外部图片失败: 状态码 ${upstream.status}, URL: ${storageKey}`);
        return new Response('获取外部文件失败', { status: upstream.status });
      }
      
      const headers = new Headers(upstream.headers);
      headers.set('Cache-Control', headers.get('Cache-Control') || 'public, max-age=86400');
      headers.set('X-Cache', 'MISS-EXTERNAL');
      
      // 移除可能导致浏览器阻止显示的跨域安全头
      headers.delete('x-frame-options');
      headers.delete('content-security-policy');
      
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (err) {
      console.error('获取外部文件抛出异常:', err.message || err, '| URL:', storageKey, '| Cause:', err.cause);
      return new Response('存储服务器获取失败 (内部错误)', { status: 500 });
    }
  }

  // 3. 从 R2 获取文件
  if (!env.R2_BUCKET) {
    return new Response('R2 not configured', { status: 500 });
  }

  try {
    // SOTA: 构建 R2 选项 (兼容 Range 和条件请求)
    const options = {};

    // 1. 处理 Range (仅支持 standard HTTP Range header)
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      options.range = request.headers; // R2 supports passing the Headers object for range
    }

    // 2. 处理条件请求 (R2Conditional)
    const onlyIf = {};
    const etagMatches = request.headers.get('If-Match');
    const etagDoesNotMatch = request.headers.get('If-None-Match');
    const uploadedBefore = request.headers.get('If-Unmodified-Since');
    const uploadedAfter = request.headers.get('If-Modified-Since');

    if (etagMatches) onlyIf.etagMatches = etagMatches;
    if (etagDoesNotMatch) onlyIf.etagDoesNotMatch = etagDoesNotMatch;
    if (uploadedBefore) onlyIf.uploadedBefore = new Date(uploadedBefore);
    if (uploadedAfter) onlyIf.uploadedAfter = new Date(uploadedAfter);

    if (Object.keys(onlyIf).length > 0) {
      options.onlyIf = onlyIf;
    }

    const object = await env.R2_BUCKET.get(storageKey, options);

    if (object === null) {
      // 如果没有找到，尝试用原始 fileId
      if (storageKey !== fileId) {
        const object2 = await env.R2_BUCKET.get(fileId);
        if (object2) {
          return buildAndCacheResponse(object2, fileRecord, cache, cacheKey, context);
        }
      }
      return new Response('File not found', { status: 404 });
    }

    return buildAndCacheResponse(object, fileRecord, cache, cacheKey, context);
  } catch (err) {
    console.error('R2 error:', err);
    return new Response('Storage error', { status: 500 });
  }
}

/**
 * 构建响应并写入 Cache
 */
async function buildAndCacheResponse(object, fileRecord, cache, cacheKey, context) {
  const headers = new Headers();

  // 使用 R2 的 writeHttpMetadata 写入响应头
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  // 设置 Content-Type（优先使用数据库记录的 MIME 类型）
  if (fileRecord?.mime_type && !headers.has('Content-Type')) {
    headers.set('Content-Type', fileRecord.mime_type);
  }

  // 🚀 缓存优化：设置长期缓存 + 不可变
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // 添加 Cache 未命中标记
  headers.set('X-Cache', 'MISS');

  // 条件请求：如果没有 body，返回 304
  if (!('body' in object)) {
    return new Response(null, { status: 304, headers });
  }

  // Range 请求返回 206
  const status = object.range ? 206 : 200;

  const response = new Response(object.body, { status, headers });

  // 4. 只缓存成功的完整响应 (不缓存 206 Range 响应)
  if (status === 200) {
    // 使用 waitUntil 异步写入 Cache，不阻塞响应
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}
