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
import { decrementRefCount } from '../../../../api/utils/blob-utils.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';

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

  try {
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
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /api/v1/files/check-hash - 预检查 (original_hash)
 */
app.post('/check-hash', async (c) => {
  const { original_hash } = await c.req.json();
  if (!original_hash) return c.json({ success: false, error: 'original_hash is required' }, 400);

  try {
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
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /api/v1/files/:id - 获取单个文件
 */
app.get('/:id', withCache(60), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  const repo = new FileRepository(env.DB);
  const file = await repo.findById(id);

  if (!file) {
    return c.json({ success: false, error: MSG.FILE.NOT_FOUND }, 404);
  }

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

  try {
    const repo = new FileRepository(env.DB);
    const id = generateId();
    const nowMs = Date.now();

    await repo.create({
      id,
      name: data.name,
      folderId: data.folderId,
      isPublic: data.isPublic,
      storageKey: id, // Default storage key
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
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * PUT /api/v1/files/:id - 更新文件
 */
app.put('/:id', requirePermission('files:write'), async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const { env } = c;

  try {
    const repo = new FileRepository(env.DB);
    const file = await repo.findById(id);
    if (!file) return c.json({ success: false, error: MSG.FILE.NOT_FOUND }, 404);

    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.folderId !== undefined) updates.folder_id = data.folderId;
    if (data.isPublic !== undefined) updates.is_public = data.isPublic ? 1 : 0;

    if (Object.keys(updates).length === 0) {
      return c.json({ success: false, error: MSG.COMMON.NO_UPDATE_FIELDS }, 400);
    }

    await repo.update(id, updates);
    // 使详情缓存和列表缓存失效
    c.executionCtx.waitUntil(invalidateCache([...getFileCacheUrls(c), c.req.url]));

    return c.json({ success: true, message: MSG.FILE.UPDATE_SUCCESS });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * DELETE /api/v1/files/:id - 删除文件
 */
app.delete('/:id', requirePermission('files:delete'), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  try {
    const repo = new FileRepository(env.DB);
    const file = await repo.findById(id);
    if (!file) return c.json({ success: false, error: MSG.FILE.NOT_FOUND }, 404);

    if (file.content_hash) {
      await decrementRefCount(env, file.content_hash);
    } else if (file.storage_key && env.R2_BUCKET) {
      await env.R2_BUCKET.delete(file.storage_key);
    }

    await repo.delete(id);
    // 使缓存失效
    c.executionCtx.waitUntil(invalidateCache(getFileCacheUrls(c)));

    return c.json({ success: true, message: MSG.FILE.DELETE_SUCCESS });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
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

    try {
      const repo = new FileRepository(env.DB);

      // 获取存储键和内容哈希
      const placeholders = ids.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT id, storage_key, content_hash FROM files WHERE id IN (${placeholders})`
      ).bind(...ids).all();

      // CAS: 分别处理有 content_hash 和没有的文件
      for (const f of results) {
        if (f.content_hash) {
          await decrementRefCount(env, f.content_hash);
        } else if (f.storage_key && env.R2_BUCKET) {
          await env.R2_BUCKET.delete(f.storage_key).catch(() => { });
        }
      }

      await repo.deleteBatch(ids);
      // 使缓存失效
      c.executionCtx.waitUntil(invalidateCache(getFileCacheUrls(c)));

      return c.json({
        success: true,
        message: MSG.FILE.BATCH_DELETE_SUCCESS.replace('{count}', results.length),
      });
    } catch (err) {
      return c.json({ success: false, error: err.message }, 500);
    }
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

    try {
      const fileRepo = new FileRepository(env.DB);
      const folderRepo = new FolderRepository(env.DB);

      // 验证目标文件夹存在
      if (targetFolderId && targetFolderId !== 'root') {
        const folder = await folderRepo.findById(targetFolderId);
        if (!folder) return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
      }

      await fileRepo.moveBatch(ids, targetFolderId || 'root');
      // 使缓存失效
      c.executionCtx.waitUntil(invalidateCache(getFileCacheUrls(c)));

      return c.json({
        success: true,
        message: MSG.FILE.MOVE_SUCCESS.replace('{count}', ids.length),
      });
    } catch (err) {
      return c.json({ success: false, error: err.message }, 500);
    }
  }
);

export default app;
