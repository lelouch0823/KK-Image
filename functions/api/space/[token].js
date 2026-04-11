/**
 * 公开空间访问 API
 * GET /api/space/:token - 获取公开空间 information
 * POST /api/space/:token - 验证密码并获取空间内容
 * 支持管理员预览模式 (携带有效 JWT 时可访问未公开空间)
 */

import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';
import { timingSafeCompare, isAdminAuthenticated } from '../utils/auth.js';
import { getFileType } from '../utils/file-utils.js';
import { parseJsonArray } from '../utils/json.js';
import { getFileUrl } from '../utils/url.js';
import { projectSpaceTemplateData } from '../../lib/hono/routes/manage/spaces/transformers.js';

function resolveSpaceAssetUrl(value) {
  const url = String(value || '').trim();
  if (!url) return null;
  if (
    url.startsWith('/') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }
  return getFileUrl(url);
}

/**
 * 获取空间数据 (GET/POST 共享逻辑)
 */
async function getSpaceData(space, env) {
  const templateData = projectSpaceTemplateData(space);
  // 并行获取文件列表和子空间
  const [filesResult, subspacesResult] = await Promise.all([
    env.DB.prepare(
      `SELECT sf.section, sf.sort_order, f.*
       FROM space_files sf
       JOIN files f ON sf.file_id = f.id
       WHERE sf.space_id = ?
       ORDER BY sf.section ASC, sf.sort_order ASC`
    )
      .bind(space.id)
      .all(),
    env.DB.prepare(
      `SELECT s.id, s.name, s.template, s.share_token, s.description, s.template_data, s.product_id, s.variant_id, s.expires_at,
              (SELECT COUNT(*) FROM space_files WHERE space_id = s.id) as file_count,
              f.storage_key as cover_storage_key,
              p.spu as p_sku, p.brand as p_brand, p.series as p_series,
              COALESCE(pv.price, (SELECT MIN(price) FROM product_variants WHERE product_id = p.id), 0) as p_price,
              p.specifications as p_specs, p.images as p_images,
              pv.sku as pv_sku,
              pv.options_values as pv_options_values,
              (
                SELECT vi.image_id
                FROM variant_images vi
                WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
                ORDER BY vi.sort_order ASC, vi.created_at ASC
                LIMIT 1
              ) as display_image_id
       FROM spaces s
       LEFT JOIN files f ON s.cover_file_id = f.id
       LEFT JOIN products p ON s.product_id = p.id
       LEFT JOIN product_variants pv ON s.variant_id = pv.id
       WHERE s.parent_id = ? AND s.is_public = 1
       ORDER BY s.sort_order ASC, s.name ASC`
    )
      .bind(space.id)
      .all(),
  ]);

  const files = filesResult.results;
  const subspaces = subspacesResult.results.filter(
    (subspace) => !subspace.expires_at || subspace.expires_at >= Date.now()
  );

  // 按 section 分组文件
  const groupedFiles = {};
  const seenFileUrls = new Set();
  const appendFile = (targetSection, file, { prepend = false } = {}) => {
    if (!file?.url || seenFileUrls.has(file.url)) return;
    seenFileUrls.add(file.url);
    if (!groupedFiles[targetSection]) groupedFiles[targetSection] = [];
    if (prepend) {
      groupedFiles[targetSection].unshift(file);
    } else {
      groupedFiles[targetSection].push(file);
    }
  };
  files.forEach((f) => {
    const section = f.section || 'default';
    appendFile(section, {
      id: f.id,
      name: f.original_name || f.name,
      size: f.size,
      type: getFileType(f.mime_type, f.name),
      mimeType: f.mime_type,
      url: getFileUrl(f.storage_key),
      thumbnailUrl: getFileType(f.mime_type, f.name) === 'image' ? getFileUrl(f.storage_key) : null,
    });
  });

  let allFiles = Object.values(groupedFiles).flat();

  // 注入商品/变体模板图片到文件列表中 (置于首部)
  if (Array.isArray(templateData.images) && templateData.images.length > 0) {
    const productFiles = templateData.images
      .map((imgUrl, index) => {
        const url = resolveSpaceAssetUrl(imgUrl);
        if (!url) return null;
        return {
        id: `product-img-${index}`,
        name: `Product Image ${index + 1}`,
        size: 0,
        type: 'image',
        mimeType: 'image/jpeg', // Assumption for rendering
        url,
        thumbnailUrl: url,
      };
      })
      .filter(Boolean);

    productFiles.slice().reverse().forEach((file) => appendFile('default', file, { prepend: true }));
    allFiles = Object.values(groupedFiles).flat();
  }

  // 封面图片 - 优先使用显式设置的封面，否则回退到第一张图片
  let coverImage = null;
  if (space.cover_file_id) {
    const coverFile = allFiles.find((f) => f.id === space.cover_file_id);
    coverImage = coverFile?.url || null;
  }
  if (!coverImage) {
    const firstImage = allFiles.find((f) => f.type === 'image');
    coverImage = firstImage?.url || null;
  }

  return {
    name: space.name,
    description: space.description,
    template: space.template,
    templateData,
    coverImage,
    coverFileId: space.cover_file_id,
    fileCount: allFiles.length,
    viewCount: space.view_count,
    files: allFiles,
    groupedFiles,
    subspaces: subspaces.map((s) => {
      const templateData = projectSpaceTemplateData(s);
      const templateImages = parseJsonArray(templateData.images, [])
        .map((image) => resolveSpaceAssetUrl(image))
        .filter(Boolean);
      const coverImage = (s.cover_storage_key ? getFileUrl(s.cover_storage_key) : null) || templateImages[0] || null;
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        template: s.template,
        templateData,
        fileCount: s.file_count || templateImages.length,
        shareUrl: s.share_token ? `/space/${s.share_token}` : null,
        coverImage,
      };
    }),
  };
}

async function recordSpaceAccess(spaceId, request, env) {
  const accessId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO space_access_logs (id, space_id, ip_address, user_agent, referrer, accessed_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      accessId,
      spaceId,
      request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '',
      request.headers.get('User-Agent') || '',
      request.headers.get('Referer') || '',
      Date.now()
    ),
    env.DB.prepare('UPDATE spaces SET view_count = view_count + 1 WHERE id = ?').bind(spaceId),
  ]);
}

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const shareToken = params.token;

  try {
    // 查找空间
    const space = await env.DB.prepare(`
        SELECT s.*,
            p.spu as p_sku, p.brand as p_brand, p.series as p_series,
            COALESCE(pv.price, (SELECT MIN(price) FROM product_variants WHERE product_id = p.id), 0) as p_price,
            p.specifications as p_specs, p.images as p_images,
            pv.sku as pv_sku,
            pv.options_values as pv_options_values,
            (
              SELECT vi.image_id
              FROM variant_images vi
              WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
              ORDER BY vi.sort_order ASC, vi.created_at ASC
              LIMIT 1
            ) as display_image_id
        FROM spaces s
        LEFT JOIN products p ON s.product_id = p.id
        LEFT JOIN product_variants pv ON s.variant_id = pv.id
        WHERE s.share_token = ?
    `).bind(shareToken).first();

    if (!space) {
      return error(MSG.SPACE.NOT_FOUND, 404);
    }

    // 检查是否公开 (管理员可预览未公开空间)
    const isAdmin = await isAdminAuthenticated(request, env);
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

    // 获取空间数据
    const data = await getSpaceData(space, env);
    // GET 请求增加访问记录
    data.viewCount = space.view_count + 1;

    // 记录访问
    await recordSpaceAccess(space.id, request, env);

    return success(data, 'Success', 200, {
      'Cache-Control':
        space.is_public && !space.password
          ? 'public, max-age=3600, stale-while-revalidate=86400'
          : 'no-store, max-age=0',
    });
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
    const password = body.password;

    if (!password) {
      return error(MSG.USER.PASSWORD_REQUIRED, 400);
    }

    // 查找空间
    const space = await env.DB.prepare(`
        SELECT s.*,
            p.spu as p_sku, p.brand as p_brand, p.series as p_series,
            COALESCE(pv.price, (SELECT MIN(price) FROM product_variants WHERE product_id = p.id), 0) as p_price,
            p.specifications as p_specs, p.images as p_images,
            pv.sku as pv_sku,
            pv.options_values as pv_options_values,
            (
              SELECT vi.image_id
              FROM variant_images vi
              WHERE vi.variant_id = s.variant_id AND vi.is_primary = 1
              ORDER BY vi.sort_order ASC, vi.created_at ASC
              LIMIT 1
            ) as display_image_id
        FROM spaces s
        LEFT JOIN products p ON s.product_id = p.id
        LEFT JOIN product_variants pv ON s.variant_id = pv.id
        WHERE s.share_token = ?
    `).bind(shareToken).first();

    if (!space) {
      return error(MSG.SPACE.NOT_FOUND, 404);
    }

    const isAdmin = await isAdminAuthenticated(request, env);
    if (!space.is_public && !isAdmin) {
      return error(MSG.SPACE.PRIVATE, 403);
    }

    if (space.expires_at && space.expires_at < Date.now()) {
      return error(MSG.SPACE.EXPIRED, 410);
    }

    // 检查是否需要密码
    if (!space.password) {
      return error(MSG.SPACE.NO_PASSWORD_REQUIRED, 400);
    }

    // 使用常量时间比较 (SOTA Security)
    if (!timingSafeCompare(password, space.password)) {
      return error(MSG.SPACE.PASSWORD_ERROR, 401);
    }

    // 密码正确，返回完整空间数据
    const data = await getSpaceData(space, env);
    data.viewCount = (Number(space.view_count) || 0) + 1;
    await recordSpaceAccess(space.id, request, env);

    return success(data, MSG.AUTH.VERIFY_SUCCESS, 200, { 'Cache-Control': 'no-store, max-age=0' });
  } catch (err) {
    console.error('Password verification failed:', err);
    return error(`${MSG.AUTH.VERIFY_FAILED}: ${err.message}`, 500);
  }
}
