import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { getFileUrl, MSG } from '../../_shared/utils.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';

const app = new Hono();

// Schemas
const DeleteFilesSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

const MoveFilesSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  targetFolderId: z.string().nullable(),
});

const RenameFileSchema = z.object({
  name: z.string().min(1).max(255),
});

/**
 * GET /api/manage/files - 获取文件列表
 */
app.get('/', async (c) => {
  const { env } = c;
  const folderId = c.req.query('folder_id');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');

  try {
    const repo = new FileRepository(env.DB);
    const filter = folderId ? { folderId } : { rootOnly: true };
    const result = await repo.findAll(filter, { page, limit });

    return c.json({
      success: true,
      data: result.items.map((f) => ({
        id: f.id,
        name: f.name,
        originalName: f.original_name,
        size: f.size,
        mimeType: f.mime_type,
        url: getFileUrl(f.storage_key),
        folderId: f.folder_id,
        createdAt: f.created_at,
      })),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * GET /api/manage/files/:id - 获取单个文件详情
 */
app.get('/:id', async (c) => {
  const { env } = c;
  const fileId = c.req.param('id');

  try {
    const repo = new FileRepository(env.DB);
    const file = await repo.findById(fileId);

    if (!file) {
      return c.json({ success: false, error: MSG.FILE.NOT_FOUND }, 404);
    }

    return c.json({
      success: true,
      data: {
        id: file.id,
        name: file.name,
        originalName: file.original_name,
        size: file.size,
        mimeType: file.mime_type,
        url: getFileUrl(file.storage_key),
        folderId: file.folder_id,
        storageKey: file.storage_key,
        createdAt: file.created_at,
        updatedAt: file.updated_at,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * PUT /api/manage/files/:id - 更新文件（重命名）
 */
app.put(
  '/:id',
  requirePermission('files:write'),
  zValidator('json', RenameFileSchema),
  async (c) => {
    const { env } = c;
    const fileId = c.req.param('id');
    const { name } = c.req.valid('json');

    try {
      const repo = new FileRepository(env.DB);
      const file = await repo.findById(fileId);
      if (!file) return c.json({ success: false, error: MSG.FILE.NOT_FOUND }, 404);

      await repo.update(fileId, { name });
      return c.json({ success: true, message: MSG.FILE.RENAME_SUCCESS });
    } catch (err) {
      return c.json({ success: false, error: err.message }, 500);
    }
  }
);

/**
 * DELETE /api/manage/files/:id - 移入回收站
 */
app.delete('/:id', requirePermission('files:delete'), async (c) => {
  const { env } = c;
  const fileId = c.req.param('id');

  try {
    const repo = new FileRepository(env.DB);
    const file = await repo.findById(fileId);
    if (!file) return c.json({ success: false, error: MSG.FILE.NOT_FOUND }, 404);

    // 软删除
    await repo.softDelete(fileId);
    return c.json({ success: true, message: MSG.FILE.DELETE_SUCCESS });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /api/manage/files/batch/delete - 批量移入回收站
 */
app.post(
  '/batch/delete',
  requirePermission('files:delete'),
  zValidator('json', DeleteFilesSchema),
  async (c) => {
    const { env } = c;
    const { ids } = c.req.valid('json');

    try {
      const repo = new FileRepository(env.DB);
      // SOTA: 软删除
      await repo.softDeleteBatch(ids);
      return c.json({ success: true, message: MSG.FILE.BATCH_DELETE_SUCCESS.replace('{count}', ids.length) });
    } catch (err) {
      return c.json({ success: false, error: err.message }, 500);
    }
  }
);

/**
 * POST /api/manage/files/batch/move - 批量移动文件
 */
app.post(
  '/batch/move',
  requirePermission('files:write'),
  zValidator('json', MoveFilesSchema),
  async (c) => {
    const { env } = c;
    const { ids, targetFolderId } = c.req.valid('json');

    try {
      if (targetFolderId && targetFolderId !== 'root') {
        const folderRepo = new FolderRepository(env.DB);
        const folder = await folderRepo.findById(targetFolderId);
        if (!folder) return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
      }

      const repo = new FileRepository(env.DB);
      await repo.moveBatch(ids, targetFolderId || 'root');

      return c.json({ success: true, message: MSG.FILE.MOVE_SUCCESS.replace('{count}', ids.length) });
    } catch (err) {
      return c.json({ success: false, error: err.message }, 500);
    }
  }
);

export default app;
