/**
 * 文件管理 API - RESTful 接口 (D1 版本)
 * GET    /api/v1/files      - 获取文件列表 (支持分页、筛选、排序)
 * POST   /api/v1/files      - 上传文件 (重定向到 /upload)
 * PUT    /api/v1/files/:id  - 更新文件信息
 * DELETE /api/v1/files/:id  - 删除文件
 */
import { hasPermission } from '../utils/auth.js';
import { triggerWebhook } from '../utils/webhook.js';
import { getFileUrl } from '../utils/url.js';
import { success, error } from '../utils/response.js';
import { getUser } from '../utils/context.js';

// 获取文件列表 (D1 SOTA: 使用 SQL 分页和筛选)
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const user = getUser(context);

  if (!hasPermission(user, 'read')) {
    return error('Read permission required', 403);
  }

  try {
    // 解析查询参数
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
    const folderId = url.searchParams.get('folder_id') || null;
    const mimeType = url.searchParams.get('type');
    const search = url.searchParams.get('search');
    const sortBy = url.searchParams.get('sort') || 'created_at';
    const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    // 动态构建 WHERE 子句
    const conditions = [];
    const params = [];

    if (folderId) {
      conditions.push('folder_id = ?');
      params.push(folderId);
    } else {
      // 默认获取根目录文件 (folder_id IS NULL)
      conditions.push('folder_id IS NULL');
    }

    if (mimeType) {
      conditions.push('mime_type LIKE ?');
      params.push(`${mimeType}%`);
    }

    if (search) {
      conditions.push('name LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 允许的排序字段白名单 (防止 SQL 注入)
    const allowedSortFields = ['created_at', 'name', 'size'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM files ${whereClause}`;
    const countResult = await env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // 获取分页数据
    const dataQuery = `
            SELECT id, folder_id, name, original_name, size, mime_type, storage_key, created_at
            FROM files
            ${whereClause}
            ORDER BY ${safeSortBy} ${order}
            LIMIT ? OFFSET ?
        `;
    const { results } = await env.DB.prepare(dataQuery).bind(...params, limit, offset).all();

    // 转换为 API 格式
    const files = results.map(f => ({
      id: f.id,
      folderId: f.folder_id,
      name: f.name,
      originalName: f.original_name,
      size: f.size,
      mimeType: f.mime_type,
      url: getFileUrl(f.storage_key, url.origin),
      createdAt: f.created_at
    }));

    return success({
      data: files,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });

  } catch (err) {
    console.error('Error fetching files:', err);
    return error(err.message, 500);
  }
}

// 更新文件信息
export async function onRequestPut(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const fileId = url.pathname.split('/').pop();

  const user = context.data?.user || context.user;

  if (!hasPermission(user, 'write')) {
    return error('Write permission required', 403);
  }

  try {
    const body = await request.json();
    const { name, folderId } = body;

    // 验证文件存在
    const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first();
    if (!file) {
      return error('File not found', 404);
    }

    // 动态构建 UPDATE
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (folderId !== undefined) {
      updates.push('folder_id = ?');
      params.push(folderId);
    }

    if (updates.length === 0) {
      return error('No fields to update', 400);
    }

    params.push(fileId);
    await env.DB.prepare(`UPDATE files SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    // 触发 Webhook
    try {
      await triggerWebhook(env, 'file.updated', {
        file: { id: fileId, ...body },
        user: user
      });
    } catch (webhookError) {
      console.error('Webhook trigger failed:', webhookError);
    }

    return success({ message: '文件已更新' });

  } catch (err) {
    console.error('Error updating file:', err);
    return error(err.message, 500);
  }
}

// 删除文件
export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const fileId = url.pathname.split('/').pop();

  const user = context.data?.user || context.user;

  if (!hasPermission(user, 'delete')) {
    return error('Delete permission required', 403);
  }

  try {
    // 获取文件信息
    const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first();
    if (!file) {
      return error('File not found', 404);
    }

    // 从 R2 删除实际文件 (如果绑定了 R2)
    if (env.R2_BUCKET && file.storage_key) {
      try {
        await env.R2_BUCKET.delete(file.storage_key);
      } catch (r2Error) {
        console.error('R2 delete failed:', r2Error);
      }
    }

    // 从 D1 删除记录
    await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run();

    // 触发 Webhook
    try {
      await triggerWebhook(env, 'file.deleted', {
        file: { id: fileId, name: file.name },
        user: user,
        deletedAt: new Date().toISOString()
      });
    } catch (webhookError) {
      console.error('Webhook trigger failed:', webhookError);
    }

    return success({ message: '文件已删除', id: fileId });

  } catch (err) {
    console.error('Error deleting file:', err);
    return error(err.message, 500);
  }
}
