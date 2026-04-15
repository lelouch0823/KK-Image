/**
 * @fileoverview 文件访问处理 (带 Cache API 优化)
 * @module file/[id]
 *
 * 基于 D1 数据库的文件服务：
 * - 从 D1 查询文件信息
 * - 使用 Cache API 缓存 R2 响应 (减少 Class B 操作)
 * - 设置适当的缓存控制头
 */

import { extractRequestToken, isAdminAuthenticated, verifyJWT, verifyScopedAccessToken } from '../api/utils/auth.js';

const ATTACHMENT_ONLY_MIME_TYPES = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/xml',
  'application/xml',
  'application/javascript',
  'text/javascript',
]);
const PUBLIC_SHARE_FILE_TTL_SECONDS = 15 * 60;

async function loadFileRecord(env, fileId) {
  if (!env.DB) return null;
  return env.DB.prepare(
    `SELECT id, folder_id, storage_key, mime_type, is_deleted, created_by
     FROM files
     WHERE storage_key = ? OR id = ?
     LIMIT 1`
  )
    .bind(fileId, fileId)
    .first();
}

async function isSalespersonAuthorizedForFile(env, request, fileRecord) {
  const salesJwt = extractRequestToken(request, { cookieName: 'sales_token' });
  if (!salesJwt) return false;

  try {
    const payload = await verifyJWT(salesJwt, env);
    if (payload.type !== 'salesperson') return false;

    const match = await env.DB.prepare(
      `SELECT 1
       FROM files f
       WHERE f.id = ?
         AND (
           f.created_by = ?
           OR EXISTS (
             SELECT 1
             FROM order_files of
             JOIN orders o ON o.id = of.order_id
             WHERE of.file_id = f.id
               AND o.salesperson_id = ?
           )
         )
       LIMIT 1`
    )
      .bind(fileRecord.id, payload.id, payload.id)
      .first();

    return Boolean(match);
  } catch {
    return false;
  }
}

async function isPublicShareAuthorized(env, request, fileId, fileRecord) {
  const accessToken = new URL(request.url).searchParams.get('access');
  if (!accessToken) return false;

  let payload;
  try {
    payload = await verifyScopedAccessToken(accessToken, env, 'public_file_access');
  } catch {
    return false;
  }

  if (String(payload.fileRef || '') !== String(fileId || '')) {
    return false;
  }

  if (payload.shareType === 'gallery') {
    const row = await env.DB.prepare(
      `SELECT 1
       FROM folders
       WHERE share_token = ?
         AND is_public = 1
         AND (share_expires_at IS NULL OR share_expires_at >= ?)
         AND id = ?
       LIMIT 1`
    )
      .bind(payload.shareToken, Date.now(), fileRecord.folder_id)
      .first();
    return Boolean(row);
  }

  if (payload.shareType === 'space') {
    const row = await env.DB.prepare(
      `SELECT 1
       FROM spaces s
       JOIN space_files sf ON sf.space_id = s.id
       WHERE s.share_token = ?
         AND s.is_public = 1
         AND (s.expires_at IS NULL OR s.expires_at >= ?)
         AND sf.file_id = ?
       LIMIT 1`
    )
      .bind(payload.shareToken, Date.now(), fileRecord.id)
      .first();
    return Boolean(row);
  }

  return false;
}

async function resolveFileAccess(context, fileId, fileRecord) {
  const { request, env } = context;
  if (!fileRecord) {
    return { error: new Response('File not found', { status: 404 }) };
  }
  if (Number(fileRecord.is_deleted) === 1) {
    return { error: new Response('File not found', { status: 404 }) };
  }

  if (await isPublicShareAuthorized(env, request, fileId, fileRecord)) {
    return { type: 'public_share' };
  }

  if (await isAdminAuthenticated(request, env)) {
    return { type: 'admin' };
  }

  if (await isSalespersonAuthorizedForFile(env, request, fileRecord)) {
    return { type: 'sales' };
  }

  return { error: new Response('Unauthorized', { status: 401 }) };
}

function applyFileCachePolicy(headers, access) {
  headers.set('Vary', 'Authorization, Cookie');
  if (access?.type === 'public_share') {
    headers.set('Cache-Control', `private, max-age=${PUBLIC_SHARE_FILE_TTL_SECONDS}`);
    return;
  }
  headers.set('Cache-Control', 'private, no-store, max-age=0');
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const fileId = params.id;

  // 1. 先查数据库并完成鉴权，避免缓存命中绕过权限检查
  let fileRecord = null;
  try {
    fileRecord = await loadFileRecord(env, fileId);
  } catch (err) {
    console.error('D1 query error:', err);
    return new Response('Database error', { status: 500 });
  }

  const access = await resolveFileAccess(context, fileId, fileRecord);
  if (access.error) return access.error;

  // 2. 确定要查找的 key
  const storageKey = fileRecord.storage_key;

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
      applyFileCachePolicy(headers, access);
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
      return new Response('File not found', { status: 404 });
    }

    return buildAndCacheResponse(object, fileRecord, access);
  } catch (err) {
    console.error('R2 error:', err);
    return new Response('Storage error', { status: 500 });
  }
}

/**
 * 构建响应
 */
async function buildAndCacheResponse(object, fileRecord, access) {
  const headers = new Headers();

  // 使用 R2 的 writeHttpMetadata 写入响应头
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  // 设置 Content-Type（优先使用数据库记录的 MIME 类型）
  if (fileRecord?.mime_type && !headers.has('Content-Type')) {
    headers.set('Content-Type', fileRecord.mime_type);
  }

  const effectiveMimeType = headers.get('Content-Type') || fileRecord?.mime_type || '';
  if (ATTACHMENT_ONLY_MIME_TYPES.has(effectiveMimeType)) {
    headers.set('Content-Disposition', 'attachment');
  }

  applyFileCachePolicy(headers, access);

  // 添加 Cache 未命中标记
  headers.set('X-Cache', 'MISS');

  // 条件请求：如果没有 body，返回 304
  if (!('body' in object)) {
    return new Response(null, { status: 304, headers });
  }

  // Range 请求返回 206
  const status = object.range ? 206 : 200;

  return new Response(object.body, { status, headers });
}
