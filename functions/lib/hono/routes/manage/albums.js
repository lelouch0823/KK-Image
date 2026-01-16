import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import {
  generateId,
  generateShareToken,
  MSG,
  getShareUrl,
  getFileUrl,
} from '../../_shared/utils.js';
import { AlbumRepository } from '../../../../repositories/AlbumRepository.js';

const app = new Hono();

// Schemas
const CreateAlbumSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  isPublic: z.boolean().optional().default(false),
  coverFileId: z.string().optional().nullable(),
});

const UpdateAlbumSchema = CreateAlbumSchema.partial();

const AlbumFilesSchema = z.object({
  fileIds: z.array(z.string()).min(1).max(100),
});

/**
 * GET /api/manage/albums - 获取相册列表
 */
app.get('/', async (c) => {
  const { env } = c;
  try {
    const repo = new AlbumRepository(env.DB);
    const results = await repo.findAll();

    return c.json({
      success: true,
      data: results.map((album) => ({
        id: album.id,
        name: album.name,
        description: album.description,
        isPublic: Boolean(album.is_public),
        shareToken: album.share_token,
        shareUrl: getShareUrl(album.share_token),
        fileCount: album.file_count,
        coverUrl: album.cover_key ? getFileUrl(album.cover_key) : null,
        createdAt: album.created_at,
        updatedAt: album.updated_at,
      })),
    });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /api/manage/albums/:id - 获取相册详情
 */
app.get('/:id', async (c) => {
  const { env } = c;
  const albumId = c.req.param('id');

  try {
    const repo = new AlbumRepository(env.DB);
    const album = await repo.findById(albumId);
    if (!album) return c.json({ success: false, error: MSG.ALBUM.NOT_FOUND }, 404);

    const files = await repo.getFiles(albumId);

    return c.json({
      success: true,
      data: {
        id: album.id,
        name: album.name,
        description: album.description,
        isPublic: Boolean(album.is_public),
        shareToken: album.share_token,
        shareUrl: getShareUrl(album.share_token),
        createdAt: album.created_at,
        updatedAt: album.updated_at,
        files: files.map((f) => ({
          id: f.id,
          name: f.name,
          originalName: f.original_name,
          size: f.size,
          mimeType: f.mime_type,
          url: getFileUrl(f.storage_key),
          createdAt: f.created_at,
        })),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /api/manage/albums - 创建相册
 */
app.post(
  '/',
  requirePermission('files:write'),
  zValidator('json', CreateAlbumSchema),
  async (c) => {
    const { env } = c;
    const { name, description, isPublic, coverFileId } = c.req.valid('json');

    try {
      const repo = new AlbumRepository(env.DB);
      const albumId = generateId();
      const shareToken = isPublic ? generateShareToken() : null;
      const nowMs = Date.now();

      await repo.create({
        id: albumId,
        name: name.trim(),
        description: description.trim(),
        isPublic,
        shareToken,
        coverFileId,
        createdAt: nowMs,
        updatedAt: nowMs
      });

      return c.json({
        success: true,
        data: { id: albumId, shareUrl: getShareUrl(shareToken) }
      }, 201);
    } catch (err) {
      return c.json({ success: false, error: err.message }, 500);
    }
  }
);

/**
 * PUT /api/manage/albums/:id - 更新相册
 */
app.put(
  '/:id',
  requirePermission('files:write'),
  zValidator('json', UpdateAlbumSchema),
  async (c) => {
    const { env } = c;
    const albumId = c.req.param('id');
    const data = c.req.valid('json');

    try {
      const repo = new AlbumRepository(env.DB);
      const album = await repo.findById(albumId);
      if (!album) return c.json({ success: false, error: MSG.ALBUM.NOT_FOUND }, 404);

      const updates = [];
      const values = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name.trim());
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description.trim());
      }
      if (data.isPublic !== undefined) {
        updates.push('is_public = ?');
        values.push(data.isPublic ? 1 : 0);
        if (data.isPublic && !album.share_token) {
          updates.push('share_token = ?');
          values.push(generateShareToken());
        }
      }
      if (data.coverFileId !== undefined) {
        updates.push('cover_file_id = ?');
        values.push(data.coverFileId);
      }

      updates.push('updated_at = ?');
      values.push(Date.now());

      const updated = await repo.update(albumId, updates, values);

      return c.json({
        success: true,
        data: {
          ...updated,
          isPublic: Boolean(updated.is_public),
          shareUrl: getShareUrl(updated.share_token),
        },
      });
    } catch (err) {
      return c.json({ success: false, error: err.message }, 500);
    }
  }
);

/**
 * DELETE /api/manage/albums/:id - 删除相册
 */
app.delete('/:id', requirePermission('files:delete'), async (c) => {
  const { env } = c;
  const albumId = c.req.param('id');

  try {
    const repo = new AlbumRepository(env.DB);
    const album = await repo.findById(albumId);
    if (!album) return c.json({ success: false, error: MSG.ALBUM.NOT_FOUND }, 404);

    await repo.delete(albumId);
    return c.json({ success: true, message: MSG.ALBUM.DELETE_SUCCESS });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /api/manage/albums/:id/files - 添加文件到相册
 */
app.post(
  '/:id/files',
  requirePermission('files:write'),
  zValidator('json', AlbumFilesSchema),
  async (c) => {
    const { env } = c;
    const albumId = c.req.param('id');
    const { fileIds } = c.req.valid('json');

    try {
      const repo = new AlbumRepository(env.DB);
      const album = await repo.findById(albumId);
      if (!album) return c.json({ success: false, error: MSG.ALBUM.NOT_FOUND }, 404);

      await repo.addFiles(albumId, fileIds);

      return c.json({
        success: true,
        message: MSG.ALBUM.ADD_FILES_SUCCESS.replace('{count}', fileIds.length),
      });
    } catch (err) {
      return c.json({ success: false, error: err.message }, 500);
    }
  }
);

/**
 * DELETE /api/manage/albums/:id/files - 从相册移除文件
 */
app.delete('/:id/files', requirePermission('files:write'), async (c) => {
  const { env } = c;
  const albumId = c.req.param('id');
  const { fileIds } = await c.req.json();

  try {
    if (!fileIds?.length) return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);

    const repo = new AlbumRepository(env.DB);
    await repo.removeFiles(albumId, fileIds);

    return c.json({
      success: true,
      message: MSG.ALBUM.REMOVE_FILES_SUCCESS.replace('{count}', fileIds.length),
    });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default app;
