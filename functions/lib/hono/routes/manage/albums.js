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
import { appendOptionalUpdate, requireEntity } from '../../_shared/route-helpers.js';
import { AlbumRepository } from '../../../../repositories/AlbumRepository.js';
import { NotFoundError, BadRequestError } from '../../errors.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/', domain: 'albums', action: 'album.create', severity: 'high', targetType: 'album' },
  { method: 'PUT', path: '/:id', domain: 'albums', action: 'album.update', severity: 'high', targetType: 'album' },
  { method: 'DELETE', path: '/:id', domain: 'albums', action: 'album.delete', severity: 'critical', targetType: 'album' },
  { method: 'POST', path: '/:id/files', domain: 'albums', action: 'album.file.add', severity: 'high', targetType: 'album' },
  { method: 'DELETE', path: '/:id/files', domain: 'albums', action: 'album.file.remove', severity: 'high', targetType: 'album' },
]);
app.use('*', requirePermission('files:read'));

function toAlbumSummary(album) {
  return {
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
  };
}

function toAlbumDetail(album, files = []) {
  return {
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
  };
}

async function requireAlbum(repo, albumId) {
  return requireEntity(repo.findById(albumId), () => new NotFoundError(MSG.ALBUM.NOT_FOUND));
}

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
  const repo = new AlbumRepository(env.DB);
  const results = await repo.findAll();

  return c.json({
    success: true,
    data: results.map(toAlbumSummary),
  });
});

/**
 * GET /api/manage/albums/:id - 获取相册详情
 */
app.get('/:id', async (c) => {
  const { env } = c;
  const albumId = c.req.param('id');

  const repo = new AlbumRepository(env.DB);
  const album = await requireAlbum(repo, albumId);

  const files = await repo.getFiles(albumId);

  return c.json({
    success: true,
    data: toAlbumDetail(album, files),
  });
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
    scheduleAuditEvent(c, {
      domain: 'albums',
      action: 'album.create',
      result: 'success',
      severity: 'high',
      targetType: 'album',
      targetId: albumId,
      target_label: name.trim(),
      summary: `Created album ${name.trim()}`,
    });

    return c.json({
      success: true,
      data: { id: albumId, shareUrl: getShareUrl(shareToken) }
    }, 201);
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

    const repo = new AlbumRepository(env.DB);
    const album = await requireAlbum(repo, albumId);

    const updates = [];
    const values = [];

    appendOptionalUpdate(updates, values, 'name = ?', data.name, (value) => value.trim());
    appendOptionalUpdate(updates, values, 'description = ?', data.description, (value) => value.trim());
    appendOptionalUpdate(updates, values, 'is_public = ?', data.isPublic, (value) => (value ? 1 : 0));
    if (data.isPublic && !album.share_token) {
      updates.push('share_token = ?');
      values.push(generateShareToken());
    }
    appendOptionalUpdate(updates, values, 'cover_file_id = ?', data.coverFileId);

    updates.push('updated_at = ?');
    values.push(Date.now());

    const updated = await repo.update(albumId, updates, values);
    scheduleAuditEvent(c, {
      domain: 'albums',
      action: 'album.update',
      result: 'success',
      severity: 'high',
      targetType: 'album',
      targetId: albumId,
      target_label: updated.name || albumId,
      summary: `Updated album ${updated.name || albumId}`,
    });

    return c.json({
      success: true,
      data: {
        ...updated,
        isPublic: Boolean(updated.is_public),
        shareUrl: getShareUrl(updated.share_token),
      },
    });
  }
);

/**
 * DELETE /api/manage/albums/:id - 删除相册
 */
app.delete('/:id', requirePermission('files:delete'), async (c) => {
  const { env } = c;
  const albumId = c.req.param('id');

  const repo = new AlbumRepository(env.DB);
  const album = await requireAlbum(repo, albumId);

  await repo.delete(albumId);
  scheduleAuditEvent(c, {
    domain: 'albums',
    action: 'album.delete',
    result: 'success',
    severity: 'critical',
    targetType: 'album',
    targetId: albumId,
    target_label: album.name,
    summary: `Deleted album ${album.name}`,
  });
  return c.json({ success: true, message: MSG.ALBUM.DELETE_SUCCESS });
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

    const repo = new AlbumRepository(env.DB);
    const album = await requireAlbum(repo, albumId);

    await repo.addFiles(albumId, fileIds);
    scheduleAuditEvent(c, {
      domain: 'albums',
      action: 'album.file.add',
      result: 'success',
      severity: 'high',
      targetType: 'album',
      targetId: albumId,
      target_label: album.name,
      summary: `Added ${fileIds.length} files to album ${album.name}`,
      metadata: { count: fileIds.length },
    });

    return c.json({
      success: true,
      message: MSG.ALBUM.ADD_FILES_SUCCESS.replace('{count}', fileIds.length),
    });
  }
);

/**
 * DELETE /api/manage/albums/:id/files - 从相册移除文件
 */
app.delete('/:id/files', requirePermission('files:write'), async (c) => {
  const { env } = c;
  const albumId = c.req.param('id');
  const { fileIds } = await c.req.json();

  if (!fileIds?.length) throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);

  const repo = new AlbumRepository(env.DB);
  await repo.removeFiles(albumId, fileIds);
  scheduleAuditEvent(c, {
    domain: 'albums',
    action: 'album.file.remove',
    result: 'success',
    severity: 'high',
    targetType: 'album',
    targetId: albumId,
    target_label: albumId,
    summary: `Removed ${fileIds.length} files from album ${albumId}`,
    metadata: { count: fileIds.length },
  });

  return c.json({
    success: true,
    message: MSG.ALBUM.REMOVE_FILES_SUCCESS.replace('{count}', fileIds.length),
  });
});

export default app;
