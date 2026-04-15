/**
 * 公开画廊 API (D1 版本)
 * GET /api/gallery/:token - 获取公开文件夹信息和文件列表
 */

import { getShareUrl, getFileUrl } from '../utils/url.js';
import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';
import { generateScopedAccessToken } from '../utils/auth.js';
import {
  checkLoginLockout,
  recordLoginFailure,
  clearLoginFailures,
} from '../../lib/hono/middleware/rateLimit.js';
import { timingSafeCompare } from '../utils/auth.js';

const PUBLIC_SHARE_FILE_TTL_SECONDS = 15 * 60;
const PUBLIC_SHARE_CACHE_CONTROL = `public, max-age=${PUBLIC_SHARE_FILE_TTL_SECONDS}, stale-while-revalidate=0`;

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

function getRateLimitKv(env) {
  return env.RATE_LIMIT_KV || env.KV || null;
}

function buildShareLockoutKey(prefix, token) {
  return `${prefix}:${token}`;
}

async function authorizePublicPasswordAttempt(env, request, identifier) {
  const kv = getRateLimitKv(env);
  const ip = getClientIp(request);
  const status = await checkLoginLockout(kv, ip, identifier);
  if (status.unavailable) {
    return error('Public share protection unavailable', 503);
  }
  if (status.locked) {
    return error(MSG.AUTH.TOO_MANY_ATTEMPTS || 'Too many attempts', 429);
  }
  return null;
}

async function recordPublicPasswordFailure(env, request, identifier) {
  const kv = getRateLimitKv(env);
  const ip = getClientIp(request);
  const status = await recordLoginFailure(kv, ip, identifier);
  if (status.unavailable) {
    return error('Public share protection unavailable', 503);
  }
  return null;
}

async function clearPublicPasswordFailures(env, request, identifier) {
  const kv = getRateLimitKv(env);
  const ip = getClientIp(request);
  if (!kv) return;
  await clearLoginFailures(kv, ip, identifier);
}

async function buildSignedFileUrl(env, fileRef, shareType, shareToken) {
  if (!env?.JWT_SECRET) {
    return getFileUrl(fileRef);
  }
  const access = await generateScopedAccessToken(
    {
      sub: fileRef,
      type: 'public_file_access',
      fileRef,
      shareType,
      shareToken,
    },
    env,
    15 * 60
  );
  const separator = getFileUrl(fileRef).includes('?') ? '&' : '?';
  return `${getFileUrl(fileRef)}${separator}access=${encodeURIComponent(access)}`;
}

async function buildGalleryResponse(folder, files, subfolders, env) {
  const getFileType = (mimeType, name) => {
    if (mimeType?.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    const ext = name?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'file';
  };

  const coverFile = files.find((f) => getFileType(f.mime_type, f.name) === 'image');
  const coverImage = coverFile
    ? await buildSignedFileUrl(env, coverFile.id, 'gallery', folder.share_token)
    : null;

  const signedFiles = await Promise.all(
    files.map(async (f) => {
      const fileRef = f.id;
      const fileType = getFileType(f.mime_type, f.name);
      const signedUrl = await buildSignedFileUrl(env, fileRef, 'gallery', folder.share_token);
      return {
        id: f.id,
        name: f.original_name || f.name,
        size: f.size,
        type: fileType,
        url: signedUrl,
        thumbnailUrl: fileType === 'image' ? signedUrl : null,
        createdAt: f.created_at,
      };
    })
  );

  return {
    name: folder.name,
    description: folder.description,
    coverImage,
    fileCount: files.length,
    createdAt: folder.created_at,
    files: signedFiles,
    subfolders: subfolders.map((sf) => ({
      id: sf.id,
      name: sf.name,
      fileCount: sf.file_count,
      shareUrl: getShareUrl(sf.share_token),
    })),
  };
}

async function loadGalleryData(env, shareToken) {
  const folder = await env.DB.prepare(
    `
      SELECT * FROM folders WHERE share_token = ?
    `
  )
    .bind(shareToken)
    .first();

  if (!folder) {
    return { errorResponse: error(MSG.FOLDER.NOT_FOUND, 404) };
  }

  if (!folder.is_public) {
    return { errorResponse: error(MSG.SPACE.PRIVATE, 403) };
  }

  if (folder.share_expires_at && Number(folder.share_expires_at) < Date.now()) {
    return { errorResponse: error(MSG.SPACE.EXPIRED || 'Share expired', 410) };
  }

  const [{ results: files }, { results: subfolders }] = await Promise.all([
    env.DB.prepare(
      `
      SELECT * FROM files WHERE folder_id = ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY created_at DESC
    `
    )
      .bind(folder.id)
      .all(),
    env.DB.prepare(
      `
      SELECT id, name, share_token, is_public,
             (SELECT COUNT(*) FROM files WHERE folder_id = folders.id AND (is_deleted IS NULL OR is_deleted = 0)) as file_count
      FROM folders 
      WHERE parent_id = ? AND is_public = 1 AND is_deleted = 0
      ORDER BY name ASC
    `
    )
      .bind(folder.id)
      .all(),
  ]);

  return { folder, files, subfolders };
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const shareToken = params.token;

  try {
    const loaded = await loadGalleryData(env, shareToken);
    if (loaded.errorResponse) return loaded.errorResponse;
    const { folder, files, subfolders } = loaded;

    if (folder.password) {
      return success({ requiresPassword: true }, MSG.SPACE.PASSWORD_REQUIRED, 401, {
        'Cache-Control': PUBLIC_SHARE_CACHE_CONTROL,
      });
    }

    return success(
      await buildGalleryResponse(folder, files, subfolders, env),
      'Success',
      200,
      {
        'Cache-Control': PUBLIC_SHARE_CACHE_CONTROL,
      }
    );
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { env, params, request } = context;
  const shareToken = params.token;

  try {
    const loaded = await loadGalleryData(env, shareToken);
    if (loaded.errorResponse) return loaded.errorResponse;
    const { folder, files, subfolders } = loaded;

    if (!folder.password) {
      return error(MSG.SPACE.NO_PASSWORD_REQUIRED, 400);
    }

    const throttleIdentifier = buildShareLockoutKey('gallery', shareToken);
    const throttleError = await authorizePublicPasswordAttempt(env, request, throttleIdentifier);
    if (throttleError) return throttleError;

    const body = await request.json();
    const password = String(body?.password || '');
    if (!password) {
      return error(MSG.USER.PASSWORD_REQUIRED, 400);
    }

    if (!timingSafeCompare(password, folder.password)) {
      const failure = await recordPublicPasswordFailure(env, request, throttleIdentifier);
      if (failure) return failure;
      return error(MSG.SPACE.PASSWORD_ERROR, 401);
    }

    await clearPublicPasswordFailures(env, request, throttleIdentifier);
    return success(
      await buildGalleryResponse(folder, files, subfolders, env),
      MSG.AUTH.VERIFY_SUCCESS,
      200,
      { 'Cache-Control': 'no-store, max-age=0' }
    );
  } catch (err) {
    console.error('Gallery password verification failed:', err);
    return error(`${MSG.AUTH.VERIFY_FAILED}: ${err.message}`, 500);
  }
}
