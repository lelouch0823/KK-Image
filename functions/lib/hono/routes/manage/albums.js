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
    const { results } = await env.DB.prepare(
      `
      SELECT a.*, 
        (SELECT COUNT(*) FROM album_files WHERE album_id = a.id) as file_count,
        (SELECT f.storage_key FROM files f 
         JOIN album_files af ON f.id = af.file_id 
         WHERE af.album_id = a.id LIMIT 1) as cover_key
      FROM albums a ORDER BY a.updated_at DESC
    `
    ).all();

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
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * GET /api/manage/albums/:id - 获取相册详情
 */
app.get('/:id', async (c) => {
  const { env } = c;
  const albumId = c.req.param('id');

  try {
    const album = await env.DB.prepare('SELECT * FROM albums WHERE id = ?').bind(albumId).first();
    if (!album) {
      return c.json({ success: false, error: MSG.ALBUM.NOT_FOUND }, 404);
    }

    // 获取相册文件
    const { results: files } = await env.DB.prepare(
      `
      SELECT f.* FROM files f
      JOIN album_files af ON f.id = af.file_id
      WHERE af.album_id = ?
      ORDER BY af.sort_order ASC, f.created_at DESC
    `
    )
      .bind(albumId)
      .all();

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
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
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
      const albumId = generateId();
      const shareToken = isPublic ? generateShareToken() : null;
      const nowMs = Date.now();

      await env.DB.prepare(
        `
        INSERT INTO albums (id, name, description, is_public, share_token, cover_file_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
        .bind(
          albumId,
          name.trim(),
          description.trim(),
          isPublic ? 1 : 0,
          shareToken,
          coverFileId || null,
          nowMs,
          nowMs
        )
        .run();

      return c.json(
        {
          success: true,
          data: {
            id: albumId,
            name: name.trim(),
            description: description.trim(),
            isPublic,
            shareToken,
            shareUrl: getShareUrl(shareToken),
            createdAt: nowMs,
          },
        },
        201
      );
    } catch (err) {
      console.error(`${MSG.COMMON.CREATE_FAILED}:`, err);
      return c.json({ success: false, error: `${MSG.COMMON.CREATE_FAILED}: ${err.message}` }, 500);
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
      const album = await env.DB.prepare('SELECT * FROM albums WHERE id = ?').bind(albumId).first();
      if (!album) {
        return c.json({ success: false, error: MSG.ALBUM.NOT_FOUND }, 404);
      }

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

        // 自动生成分享令牌
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
      values.push(albumId);

      await env.DB.prepare(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      const updated = await env.DB.prepare('SELECT * FROM albums WHERE id = ?')
        .bind(albumId)
        .first();

      return c.json({
        success: true,
        data: {
          ...updated,
          isPublic: Boolean(updated.is_public),
          shareUrl: getShareUrl(updated.share_token),
        },
      });
    } catch (err) {
      console.error(`${MSG.COMMON.UPDATE_FAILED}:`, err);
      return c.json({ success: false, error: `${MSG.COMMON.UPDATE_FAILED}: ${err.message}` }, 500);
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
    const album = await env.DB.prepare('SELECT id FROM albums WHERE id = ?').bind(albumId).first();
    if (!album) {
      return c.json({ success: false, error: MSG.ALBUM.NOT_FOUND }, 404);
    }

    // 删除相册（不删除文件本身）
    await env.DB.batch([
      env.DB.prepare('DELETE FROM album_files WHERE album_id = ?').bind(albumId),
      env.DB.prepare('DELETE FROM albums WHERE id = ?').bind(albumId),
    ]);

    return c.json({ success: true, message: MSG.ALBUM.DELETE_SUCCESS });
  } catch (err) {
    console.error(`${MSG.COMMON.DELETE_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.DELETE_FAILED}: ${err.message}` }, 500);
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
      const album = await env.DB.prepare('SELECT id FROM albums WHERE id = ?')
        .bind(albumId)
        .first();
      if (!album) {
        return c.json({ success: false, error: MSG.ALBUM.NOT_FOUND }, 404);
      }

      // 批量插入
      const statements = fileIds.map((fileId, index) =>
        env.DB.prepare(
          'INSERT OR IGNORE INTO album_files (album_id, file_id, sort_order) VALUES (?, ?, ?)'
        ).bind(albumId, fileId, index)
      );

      await env.DB.batch(statements);

      // 更新相册时间
      await env.DB.prepare('UPDATE albums SET updated_at = ? WHERE id = ?')
        .bind(Date.now(), albumId)
        .run();

      return c.json({
        success: true,
        message: MSG.ALBUM.ADD_FILES_SUCCESS.replace('{count}', fileIds.length),
      });
    } catch (err) {
      console.error(`${MSG.COMMON.OP_FAILED}:`, err);
      return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
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
    if (!fileIds?.length) {
      return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);
    }

    const placeholders = fileIds.map(() => '?').join(',');
    await env.DB.prepare(
      `DELETE FROM album_files WHERE album_id = ? AND file_id IN (${placeholders})`
    )
      .bind(albumId, ...fileIds)
      .run();

    return c.json({
      success: true,
      message: MSG.ALBUM.REMOVE_FILES_SUCCESS.replace('{count}', fileIds.length),
    });
  } catch (err) {
    console.error(`${MSG.COMMON.OP_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
  }
});

export default app;
