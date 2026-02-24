import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  FileQuerySchema,
  CreateFileSchema,
  BatchFileSchema,
  MoveFileSchema,
} from '../../schemas/file.js';
import { requirePermission } from '../../middleware/auth.js';
import { withCache, invalidateCache } from '../../middleware/cache.js';
import { getFileUrl, generateId, MSG } from '../../_shared/utils.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { NotFoundError, BadRequestError } from '../../errors.js';

const app = new Hono();

/** sort 列名白名单 - 二次防御 SQL 注入 */
const ALLOWED_SORT_COLUMNS = {
  created_at: 'created_at',
  name: 'name',
  size: 'size',
  updated_at: 'updated_at',
};

/**
 * 构建缓存失效 URL
 */
const getFileCacheUrls = (c) => {
  const origin = new URL(c.req.url).origin;
  return [
    `${origin}/api/v1/files`,
    `${origin}/api/v1/files?page=1&limit=20`,
  ];
};

/**
 * GET /api/v1/files - 获取文件列表
 */
app.get('/', zValidator('query', FileQuerySchema), withCache(30), async (c) => {
  const { page, limit, sort, order, folderId, search, type, isPublic } = c.req.valid('query');
  const { env } = c;

  // 二次验证 sort 列名（Zod 已校验，这里做防御性编程）
  const safeSort = ALLOWED_SORT_COLUMNS[sort] || 'created_at';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

  let sql = 'SELECT * FROM files WHERE 1=1';
  const bindings = [];

  if (folderId) {
    sql += ' AND folder_id = ?';
    bindings.push(folderId);
  } else {
    sql += " AND (folder_id = 'root' OR folder_id IS NULL)";
  }

  // 过滤已删除文件
  sql += ' AND (is_deleted IS NULL OR is_deleted = 0)';

  if (search) {
    sql += ' AND (name LIKE ? OR original_name LIKE ?)';
    bindings.push(`%${search}%`, `%${search}%`);
  }

  if (type && type !== 'all') {
    sql += ' AND mime_type LIKE ?';
    bindings.push(`${type}/%`);
  }

  if (typeof isPublic === 'boolean') {
    sql += ' AND is_public = ?';
    bindings.push(isPublic ? 1 : 0);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await env.DB.prepare(countSql).bind(...bindings).first();
  const total = countResult?.total || 0;

  sql += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
  bindings.push(limit, (page - 1) * limit);

  const { results } = await env.DB.prepare(sql).bind(...bindings).all();

  return c.json({
    success: true,
    data: results.map((file) => ({
      ...file,
      url: getFileUrl(file.storage_key),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * POST /api/v1/files/check-hash - 预检查 (original_hash)
 */
app.post('/check-hash', async (c) => {
  const { original_hash } = await c.req.json();
  if (!original_hash) throw new BadRequestError('original_hash is required');

  const repo = new FileRepository(c.env.DB);
  const existingFile = await repo.findByOriginalHash(original_hash);

  if (existingFile) {
    return c.json({
      success: true,
      data: {
        exists: true,
        file: {
          id: existingFile.id,
          name: existingFile.name,
          url: getFileUrl(existingFile.storage_key),
          mimeType: existingFile.mime_type,
          size: existingFile.size,
          instantUpload: true,
        }
      },
      message: MSG.FILE.INSTANT_UPLOAD
    });
  }

  return c.json({ success: true, data: { exists: false } });
});

/**
 * GET /api/v1/files/:id - 获取单个文件
 */
app.get('/:id', withCache(60), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  const repo = new FileRepository(env.DB);
  const file = await repo.findById(id);

  if (!file) throw new NotFoundError(MSG.FILE.NOT_FOUND);

  return c.json({
    success: true,
    data: {
      ...file,
      url: getFileUrl(file.storage_key),
    },
  });
});

/**
 * POST /api/v1/files - 创建文件记录
 */
app.post('/', requirePermission('files:write'), zValidator('json', CreateFileSchema), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user');
  const { env } = c;

  const repo = new FileRepository(env.DB);
  const id = generateId();
  const nowMs = Date.now();

  await repo.create({
    id,
    name: data.name,
    folderId: data.folderId,
    isPublic: data.isPublic,
    storageKey: id,
    createdBy: user.id,
    createdAt: nowMs,
    updatedAt: nowMs
  });

  // 使缓存失效
  c.executionCtx.waitUntil(invalidateCache(getFileCacheUrls(c)));

  return c.json({
    success: true,
    data: { id, ...data, createdAt: nowMs },
  }, 201);
});

/**
 * PUT /api/v1/files/:id - 更新文件
 */
app.put('/:id', requirePermission('files:write'), async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const { env } = c;

  const repo = new FileRepository(env.DB);
  const file = await repo.findById(id);
  if (!file) throw new NotFoundError(MSG.FILE.NOT_FOUND);

  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.folderId !== undefined) updates.folder_id = data.folderId;
  if (data.isPublic !== undefined) updates.is_public = data.isPublic ? 1 : 0;

  if (Object.keys(updates).length === 0) {
    throw new BadRequestError(MSG.COMMON.NO_UPDATE_FIELDS);
  }

  await repo.update(id, updates);
  // 使详情缓存和列表缓存失效
  c.executionCtx.waitUntil(invalidateCache([...getFileCacheUrls(c), c.req.url]));

  return c.json({ success: true, message: MSG.FILE.UPDATE_SUCCESS });
});

/**
 * DELETE /api/v1/files/:id - 删除文件
 */
app.delete('/:id', requirePermission('files:delete'), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  const repo = new FileRepository(env.DB);
  const file = await repo.findById(id);
  if (!file) throw new NotFoundError(MSG.FILE.NOT_FOUND);

  // 软删除 (Recycle Bin)
  await repo.softDelete(id);

  // 使缓存失效
  c.executionCtx.waitUntil(invalidateCache(getFileCacheUrls(c)));

  return c.json({ success: true, message: MSG.FILE.DELETE_SUCCESS });
});

/**
 * POST /api/v1/files/batch/delete - 批量删除文件
 */
app.post(
  '/batch/delete',
  requirePermission('files:delete'),
  zValidator('json', BatchFileSchema),
  async (c) => {
    const { ids } = c.req.valid('json');
    const { env } = c;

    const repo = new FileRepository(env.DB);

    // 软删除
    await repo.softDeleteBatch(ids);

    // 使缓存失效
    c.executionCtx.waitUntil(invalidateCache(getFileCacheUrls(c)));

    return c.json({
      success: true,
      message: MSG.FILE.BATCH_DELETE_SUCCESS.replace('{count}', ids.length),
    });
  }
);

/**
 * POST /api/v1/files/batch/move - 批量移动文件
 */
app.post(
  '/batch/move',
  requirePermission('files:write'),
  zValidator('json', MoveFileSchema),
  async (c) => {
    const { ids, targetFolderId } = c.req.valid('json');
    const { env } = c;

    const fileRepo = new FileRepository(env.DB);
    const folderRepo = new FolderRepository(env.DB);

    // 验证目标文件夹存在
    if (targetFolderId && targetFolderId !== 'root') {
      const folder = await folderRepo.findById(targetFolderId);
      if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);
    }

    await fileRepo.moveBatch(ids, targetFolderId || 'root');
    // 使缓存失效
    c.executionCtx.waitUntil(invalidateCache(getFileCacheUrls(c)));

    return c.json({
      success: true,
      message: MSG.FILE.MOVE_SUCCESS.replace('{count}', ids.length),
    });
  }
);

export default app;
