import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  FolderQuerySchema,
  CreateFolderSchema,
  UpdateFolderSchema,
  ShareSettingsSchema,
} from '../../schemas/folder.js';
import { requirePermission } from '../../middleware/auth.js';
import { withCache, invalidateCache } from '../../middleware/cache.js';
import { generateId, generateShareToken, now, MSG } from '../../_shared/utils.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { createCacheInvalidator } from '../../_shared/route-helpers.js';
import { NotFoundError, BadRequestError } from '../../errors.js';

const app = new Hono();

const getFolderCacheUrls = createCacheInvalidator('/api/v1/folders', ['parentId=null']);

/**
 * GET /api/v1/folders - 获取文件夹列表
 */
app.get('/', zValidator('query', FolderQuerySchema), withCache(30), async (c) => {
  const { page, limit, parentId, search, includeFiles: _includeFiles } = c.req.valid('query');
  const { env } = c;

  let sql = 'SELECT * FROM folders WHERE 1=1';
  const bindings = [];

  if (parentId === null || parentId === 'null') {
    sql += ' AND parent_id IS NULL';
  } else if (parentId) {
    sql += ' AND parent_id = ?';
    bindings.push(parentId);
  }

  // 过滤已删除文件夹
  sql += ' AND (is_deleted IS NULL OR is_deleted = 0)';

  if (search) {
    sql += ' AND name LIKE ?';
    bindings.push(`%${search}%`);
  }

  // 获取总数
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await env.DB.prepare(countSql)
    .bind(...bindings)
    .first();
  const total = countResult?.total || 0;

  // 分页查询
  sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
  bindings.push(limit, (page - 1) * limit);

  const { results: folders } = await env.DB.prepare(sql)
    .bind(...bindings)
    .all();

  // 添加文件计数
  const foldersWithStats = await Promise.all(
    folders.map(async (folder) => {
      const fileCount = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM files WHERE folder_id = ?'
      )
        .bind(folder.id)
        .first();

      const subfolderCount = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM folders WHERE parent_id = ?'
      )
        .bind(folder.id)
        .first();

      return {
        ...folder,
        fileCount: fileCount?.count || 0,
        subfolderCount: subfolderCount?.count || 0,
      };
    })
  );

  return c.json({
    success: true,
    data: foldersWithStats,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /api/v1/folders/:id - 获取单个文件夹
 */
app.get('/:id', withCache(60), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first();

  if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

  // 获取文件和子文件夹
  const [filesResult, subfoldersResult] = await Promise.all([
    env.DB.prepare('SELECT * FROM files WHERE folder_id = ? ORDER BY created_at DESC')
      .bind(id)
      .all(),
    env.DB.prepare('SELECT * FROM folders WHERE parent_id = ? ORDER BY name ASC').bind(id).all(),
  ]);

  return c.json({
    success: true,
    data: {
      ...folder,
      files: filesResult.results,
      subfolders: subfoldersResult.results,
    },
  });
});

/**
 * POST /api/v1/folders - 创建文件夹
 */
app.post(
  '/',
  requirePermission('folders:write'),
  zValidator('json', CreateFolderSchema),
  async (c) => {
    const data = c.req.valid('json');
    const _user = c.get('user');
    const { env } = c;

    // 验证父文件夹存在
    if (data.parentId) {
      const parent = await env.DB.prepare('SELECT id FROM folders WHERE id = ?')
        .bind(data.parentId)
        .first();
      if (!parent) throw new NotFoundError(MSG.FOLDER.PARENT_NOT_FOUND);
    }

    const id = generateId();
    const shareToken = generateShareToken(16);
    const timestamp = now();

    await env.DB.prepare(
      `
      INSERT INTO folders (id, name, parent_id, description, is_public, password, share_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        id,
        data.name,
        data.parentId || null,
        data.description || null,
        data.isPublic ? 1 : 0,
        data.password || null,
        shareToken,
        timestamp,
        timestamp
      )
      .run();

    // 使缓存失效
    c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

    return c.json(
      {
        success: true,
        data: { id, shareToken, ...data, createdAt: timestamp },
      },
      201
    );
  }
);

/**
 * PUT /api/v1/folders/:id - 更新文件夹
 */
app.put(
  '/:id',
  requirePermission('folders:write'),
  zValidator('json', UpdateFolderSchema),
  async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const { env } = c;

    const folder = await env.DB.prepare('SELECT id FROM folders WHERE id = ?').bind(id).first();
    if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const dbKey = key === 'isPublic' ? 'is_public' : key === 'parentId' ? 'parent_id' : key;
        updates.push(`${dbKey} = ?`);
        values.push(key === 'isPublic' ? (value ? 1 : 0) : value);
      }
    }

    if (updates.length === 0) throw new BadRequestError(MSG.COMMON.NO_UPDATE_FIELDS);

    updates.push('updated_at = ?');
    values.push(now());
    values.push(id);

    await env.DB.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    // 使缓存失效
    c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

    return c.json({ success: true, message: MSG.FOLDER.UPDATE_SUCCESS });
  }
);

/**
 * DELETE /api/v1/folders/:id - 删除文件夹
 */
app.delete('/:id', requirePermission('folders:delete'), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  const folder = await env.DB.prepare('SELECT id FROM folders WHERE id = ?').bind(id).first();
  if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

  // 检查是否有子文件夹或文件
  const subfoldersCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM folders WHERE parent_id = ?'
  )
    .bind(id)
    .first();
  const filesCount = await env.DB.prepare('SELECT COUNT(*) as count FROM files WHERE folder_id = ?')
    .bind(id)
    .first();

  if ((subfoldersCount?.count || 0) > 0 || (filesCount?.count || 0) > 0) {
    return c.json(
      {
        success: false,
        error: MSG.FOLDER.EMPTY_INVALID,
      },
      400
    );
  }

  // 软删除
  const repo = new FolderRepository(env.DB);
  await repo.softDelete(id);

  // 使缓存失效
  c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

  return c.json({ success: true, message: MSG.FOLDER.DELETE_SUCCESS });
});

/**
 * PUT /api/v1/folders/:id/share - 更新分享设置
 */
app.put(
  '/:id/share',
  requirePermission('folders:write'),
  zValidator('json', ShareSettingsSchema),
  async (c) => {
    const id = c.req.param('id');
    const { isPublic, password, expiresAt } = c.req.valid('json');
    const { env } = c;

    const expiresAtTs = expiresAt ? new Date(expiresAt).getTime() : null;
    await env.DB.prepare(
      `
      UPDATE folders SET is_public = ?, password = ?, share_expires_at = ?, updated_at = ?
      WHERE id = ?
    `
    )
      .bind(isPublic ? 1 : 0, password || null, expiresAtTs, now(), id)
      .run();

    // 使缓存失效
    c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

    // 获取更新后的分享信息
    const folder = await env.DB.prepare(
      'SELECT share_token, is_public, password, share_expires_at FROM folders WHERE id = ?'
    )
      .bind(id)
      .first();

    return c.json({
      success: true,
      data: {
        shareToken: folder?.share_token,
        isPublic: !!folder?.is_public,
        hasPassword: !!folder?.password,
        expiresAt: folder?.share_expires_at,
      },
    });
  }
);

export default app;
