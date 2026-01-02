/**
 * 公开空间访问 API
 * GET /api/space/:token - 获取公开空间 information
 * 支持管理员预览模式 (携带有效 JWT 时可访问未公开空间)
 */

import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';
import { verifyJWT } from '../utils/auth.js';
import { parse as parseCookie } from 'cookie';

// 常量时间密码比较 (防止时序攻击)
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) {
    // 比较一个虚拟值以保持时间一致
    crypto.subtle.timingSafeEqual?.(bufA, bufA);
    return false;
  }
  // Cloudflare Workers 支持 crypto.subtle.timingSafeEqual
  if (crypto.subtle.timingSafeEqual) {
    return crypto.subtle.timingSafeEqual(bufA, bufB);
  }
  // 回退：手动实现常量时间比较
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

// 检查是否为已认证管理员
async function isAuthenticated(request, env) {
  try {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookie(cookieHeader);
    const token = cookies.auth_token;
    if (!token) return false;
    await verifyJWT(token, env);
    return true;
  } catch {
    return false;
  }
}

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const shareToken = params.token;

  try {
    // 查找空间
    const space = await env.DB.prepare(
      `
            SELECT * FROM spaces WHERE share_token = ?
        `
    )
      .bind(shareToken)
      .first();

    if (!space) {
      return error(MSG.SPACE.NOT_FOUND, 404);
    }

    // 检查是否公开 (管理员可预览未公开空间)
    const isAdmin = await isAuthenticated(request, env);
    if (!space.is_public && !isAdmin) {
      return error(MSG.SPACE.PRIVATE, 403);
    }

    // 检查是否过期
    if (space.expires_at && space.expires_at < Date.now()) {
      return error(MSG.SPACE.EXPIRED, 410);
    }

    // 检查密码 (GET 请求不再接受 URL 中的密码，需要用 POST)
    if (space.password) {
      return success({ requiresPassword: true }, MSG.SPACE.PASSWORD_REQUIRED, 401);
    }

    // 获取文件列表
    const { results: files } = await env.DB.prepare(
      `
            SELECT sf.section, sf.sort_order, f.*
            FROM space_files sf
            JOIN files f ON sf.file_id = f.id
            WHERE sf.space_id = ?
            ORDER BY sf.section ASC, sf.sort_order ASC
        `
    )
      .bind(space.id)
      .all();

    // 获取子空间 (带封面图)
    const { results: subspaces } = await env.DB.prepare(
      `
            SELECT s.id, s.name, s.template, s.share_token, s.description,
                   (SELECT COUNT(*) FROM space_files WHERE space_id = s.id) as file_count,
                   f.storage_key as cover_storage_key
            FROM spaces s
            LEFT JOIN files f ON s.cover_file_id = f.id
            WHERE s.parent_id = ? AND s.is_public = 1
            ORDER BY s.sort_order ASC, s.name ASC
        `
    )
      .bind(space.id)
      .all();

    // 记录访问
    const accessId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    await env.DB.prepare(
      `
            INSERT INTO space_access_logs (id, space_id, ip_address, user_agent, referrer, accessed_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `
    )
      .bind(
        accessId,
        space.id,
        request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '',
        request.headers.get('User-Agent') || '',
        request.headers.get('Referer') || '',
        Date.now()
      )
      .run();

    // 更新访问计数
    await env.DB.prepare('UPDATE spaces SET view_count = view_count + 1 WHERE id = ?')
      .bind(space.id)
      .run();

    // 判断文件类型
    const getFileType = (mimeType, name) => {
      if (mimeType?.startsWith('image/')) return 'image';
      if (mimeType === 'application/pdf') return 'pdf';
      const ext = name?.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image';
      if (ext === 'pdf') return 'pdf';
      return 'file';
    };

    // 按 section 分组文件
    const groupedFiles = {};
    files.forEach((f) => {
      const section = f.section || 'default';
      if (!groupedFiles[section]) {
        groupedFiles[section] = [];
      }
      groupedFiles[section].push({
        id: f.id,
        name: f.original_name || f.name,
        size: f.size,
        type: getFileType(f.mime_type, f.name),
        mimeType: f.mime_type,
        url: `/file/${f.storage_key}`,
        thumbnailUrl:
          getFileType(f.mime_type, f.name) === 'image' ? `/file/${f.storage_key}` : null,
      });
    });

    // 封面图片 - 优先使用显式设置的封面，否则回退到第一张图片
    const allFiles = Object.values(groupedFiles).flat();
    let coverImage = null;
    if (space.cover_file_id) {
      const coverFile = allFiles.find((f) => f.id === space.cover_file_id);
      coverImage = coverFile?.url || null;
    }
    if (!coverImage) {
      // 回退到第一张图片
      const firstImage = allFiles.find((f) => f.type === 'image');
      coverImage = firstImage?.url || null;
    }

    return success(
      {
        name: space.name,
        description: space.description,
        template: space.template,
        templateData: space.template_data ? JSON.parse(space.template_data) : null,
        coverImage,
        coverFileId: space.cover_file_id,
        fileCount: allFiles.length,
        viewCount: space.view_count + 1,
        files: allFiles,
        groupedFiles,
        subspaces: subspaces.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          template: s.template,
          fileCount: s.file_count,
          shareUrl: s.share_token ? `/space/${s.share_token}` : null,
          coverImage: s.cover_storage_key ? `/file/${s.cover_storage_key}` : null,
        })),
      },
      'Success',
      200,
      {
        'Cache-Control':
          space.is_public && !space.password
            ? 'public, max-age=3600, stale-while-revalidate=86400'
            : 'no-store, max-age=0',
      }
    );
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
  }
}

/**
 * POST /api/space/:token - 验证密码并获取空间内容
 * 使用常量时间比较防止时序攻击，验证成功后直接返回完整数据
 */
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const shareToken = params.token;

  try {
    const body = await request.json();
    const providedPassword = body.password;

    if (!providedPassword || typeof providedPassword !== 'string') {
      return error(MSG.COMMON.INVALID_PARAMS || '密码不能为空', 400);
    }

    // 查找空间
    const space = await env.DB.prepare('SELECT * FROM spaces WHERE share_token = ?')
      .bind(shareToken)
      .first();

    if (!space) {
      return error(MSG.SPACE.NOT_FOUND, 404);
    }

    // 检查是否需要密码
    if (!space.password) {
      return error('此空间无需密码', 400);
    }

    // 使用常量时间比较
    if (!timingSafeCompare(providedPassword, space.password)) {
      return error(MSG.SPACE.PASSWORD_REQUIRED || '密码错误', 401);
    }

    // 密码正确，返回完整空间数据
    // 获取文件列表
    const { results: files } = await env.DB.prepare(
      `SELECT sf.section, sf.sort_order, f.*
       FROM space_files sf
       JOIN files f ON sf.file_id = f.id
       WHERE sf.space_id = ?
       ORDER BY sf.section ASC, sf.sort_order ASC`
    )
      .bind(space.id)
      .all();

    // 获取子空间
    const { results: subspaces } = await env.DB.prepare(
      `SELECT s.id, s.name, s.template, s.share_token, s.description,
              (SELECT COUNT(*) FROM space_files WHERE space_id = s.id) as file_count,
              f.storage_key as cover_storage_key
       FROM spaces s
       LEFT JOIN files f ON s.cover_file_id = f.id
       WHERE s.parent_id = ? AND s.is_public = 1
       ORDER BY s.sort_order ASC, s.name ASC`
    )
      .bind(space.id)
      .all();

    // 判断文件类型
    const getFileType = (mimeType, name) => {
      if (mimeType?.startsWith('image/')) return 'image';
      if (mimeType === 'application/pdf') return 'pdf';
      const ext = name?.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image';
      if (ext === 'pdf') return 'pdf';
      return 'file';
    };

    // 按 section 分组文件
    const groupedFiles = {};
    files.forEach((f) => {
      const section = f.section || 'default';
      if (!groupedFiles[section]) groupedFiles[section] = [];
      groupedFiles[section].push({
        id: f.id,
        name: f.original_name || f.name,
        size: f.size,
        type: getFileType(f.mime_type, f.name),
        mimeType: f.mime_type,
        url: `/file/${f.storage_key}`,
        thumbnailUrl: getFileType(f.mime_type, f.name) === 'image' ? `/file/${f.storage_key}` : null,
      });
    });

    const allFiles = Object.values(groupedFiles).flat();
    let coverImage = null;
    if (space.cover_file_id) {
      const coverFile = allFiles.find((f) => f.id === space.cover_file_id);
      coverImage = coverFile?.url || null;
    }
    if (!coverImage) {
      const firstImage = allFiles.find((f) => f.type === 'image');
      coverImage = firstImage?.url || null;
    }

    return success(
      {
        name: space.name,
        description: space.description,
        template: space.template,
        templateData: space.template_data ? JSON.parse(space.template_data) : null,
        coverImage,
        coverFileId: space.cover_file_id,
        fileCount: allFiles.length,
        viewCount: space.view_count,
        files: allFiles,
        groupedFiles,
        subspaces: subspaces.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          template: s.template,
          fileCount: s.file_count,
          shareUrl: s.share_token ? `/space/${s.share_token}` : null,
          coverImage: s.cover_storage_key ? `/file/${s.cover_storage_key}` : null,
        })),
      },
      '密码验证成功',
      200,
      { 'Cache-Control': 'no-store, max-age=0' }
    );
  } catch (err) {
    console.error('密码验证失败:', err);
    return error(`验证失败: ${err.message}`, 500);
  }
}
