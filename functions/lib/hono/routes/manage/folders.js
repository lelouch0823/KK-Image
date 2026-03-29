import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';

import {
  generateId,
  generateShareToken,
  timestampToIso,
  MSG,
  getShareUrl,
  getFileUrl,
} from '../../_shared/utils.js';

import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../../errors.js';
import { appendOptionalUpdate, requireEntity } from '../../_shared/route-helpers.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/', domain: 'folders', action: 'folder.create', severity: 'high', targetType: 'folder' },
  { method: 'PUT', path: '/:id', domain: 'folders', action: 'folder.update', severity: 'high', targetType: 'folder' },
  { method: 'DELETE', path: '/:id', domain: 'folders', action: 'folder.delete', severity: 'critical', targetType: 'folder' },
  { method: 'POST', path: '/:id/upload', domain: 'folders', action: 'folder.upload', severity: 'normal', targetType: 'folder' },
]);
app.use('*', requirePermission('folders:read'));

function toFolderListItem(folder) {
  return {
    ...folder,
    isPublic: Boolean(folder.is_public),
    createdAt: folder.created_at,
    updatedAt: folder.updated_at,
    subfolderCount: folder.subfolder_count,
    fileCount: folder.file_count,
  };
}

async function requireFolder(folderRepo, folderId) {
  return requireEntity(folderRepo.findById(folderId), () => new NotFoundError(MSG.FOLDER.NOT_FOUND));
}

// Schemas
const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  parentId: z.string().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  password: z.string().min(4).max(50).optional().nullable(),
});

const UpdateFolderSchema = CreateFolderSchema.partial().extend({
  shareExpiresAt: z.number().optional().nullable(),
});

/**
 * GET /api/manage/folders - 获取文件夹列表
 */
app.get('/', async (c) => {
  const { env } = c;
  const url = new URL(c.req.url);
  const parentId = url.searchParams.get('parent_id') || null;
  const all = url.searchParams.get('all') === 'true';
  const folderRepo = new FolderRepository(env.DB);

  let results;
  if (all) {
    results = await folderRepo.findAllMinimal();
  } else if (parentId) {
    results = await folderRepo.findByParent(parentId);
  } else {
    results = await folderRepo.findTopLevel();
  }

  return c.json({
    success: true,
    data: results.map(toFolderListItem),
  });
});

/**
 * GET /api/manage/folders/:id - 获取文件夹详情
 */
app.get('/:id', async (c) => {
  const { env } = c;
  const folderId = c.req.param('id');
  const folderRepo = new FolderRepository(env.DB);
  const fileRepo = new FileRepository(env.DB);

  const folder = await requireFolder(folderRepo, folderId);

  // 并行获取子文件夹和文件
  const [subfolders, files, breadcrumbs] = await Promise.all([
    folderRepo.findByParent(folderId),
    fileRepo.findByFolder(folderId),
    folderRepo.getBreadcrumbs(folderId)
  ]);

  return c.json({
    success: true,
    data: {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      parentId: folder.parent_id,
      shareToken: folder.share_token,
      isPublic: Boolean(folder.is_public),
      hasPassword: !!folder.password,
      createdAt: folder.created_at,
      updatedAt: folder.updated_at,
      shareUrl: getShareUrl(folder.share_token),
      breadcrumbs,
      subfolders: subfolders.map((f) => ({
        id: f.id,
        name: f.name,
        subfolderCount: f.subfolder_count,
        fileCount: f.file_count,
        isPublic: Boolean(f.is_public),
        createdAt: f.created_at,
      })),
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
});

/**
 * POST /api/manage/folders - 创建文件夹
 */
app.post(
  '/',
  requirePermission('folders:write'),
  zValidator('json', CreateFolderSchema),
  async (c) => {
    const { env } = c;
    const { name, description, parentId, isPublic, password } = c.req.valid('json');
    const folderRepo = new FolderRepository(env.DB);

    if (parentId) {
      const parent = await folderRepo.findById(parentId);
      if (!parent) throw new BadRequestError(MSG.FOLDER.PARENT_NOT_FOUND);
    }

    const hasConflict = await folderRepo.checkNameConflict(parentId, name.trim());
    if (hasConflict) throw new ConflictError(MSG.FOLDER.NAME_CONFLICT || "当前目录下已存在同名文件夹");

    const folderId = generateId();
    const shareToken = isPublic ? generateShareToken() : null;
    const nowMs = Date.now();

    await folderRepo.create({
      id: folderId,
      parentId: parentId || null,
      name: name.trim(),
      description: description.trim(),
      shareToken,
      isPublic,
      password: password || null,
      createdAt: nowMs,
      updatedAt: nowMs
    });

    await publishSingleDomainEventAndPoll(c, {
      event_type: 'folder_created',
      aggregate_type: 'folder',
      aggregate_id: folderId,
      payload: {
        folder_id: folderId,
      },
    }, `folder-create:${folderId}`);
    scheduleAuditEvent(c, {
      domain: 'folders',
      action: 'folder.create',
      result: 'success',
      severity: 'high',
      targetType: 'folder',
      targetId: folderId,
      target_label: name.trim(),
      summary: `Created folder ${name.trim()}`,
      metadata: { parentId: parentId || null, isPublic },
    });

    return c.json(
      {
        success: true,
        data: {
          id: folderId,
          name: name.trim(),
          description: description.trim(),
          parentId,
          shareToken,
          isPublic,
          shareUrl: getShareUrl(shareToken),
          createdAt: nowMs,
        },
      },
      201
    );
  }
);

/**
 * PUT /api/manage/folders/:id - 更新文件夹
 */
app.put(
  '/:id',
  requirePermission('folders:write'),
  zValidator('json', UpdateFolderSchema),
  async (c) => {
    const { env } = c;
    const folderId = c.req.param('id');
    const data = c.req.valid('json');
    const folderRepo = new FolderRepository(env.DB);

    const folder = await requireFolder(folderRepo, folderId);

    const updates = [];
    const values = [];

    // 判断是否需要进行重名校验
    let checkParentId = folder.parent_id;
    let checkName = folder.name;
    if (data.parentId !== undefined) checkParentId = data.parentId || null;
    if (data.name !== undefined) checkName = data.name.trim();

    if (data.name !== undefined || data.parentId !== undefined) {
      if (checkParentId !== folder.parent_id || checkName !== folder.name) {
        const hasConflict = await folderRepo.checkNameConflict(checkParentId, checkName, folderId);
        if (hasConflict) throw new ConflictError(MSG.FOLDER.NAME_CONFLICT || "在目标目录下已存在同名文件夹");
      }
    }

    appendOptionalUpdate(updates, values, 'name = ?', data.name, (value) => value.trim());
    appendOptionalUpdate(updates, values, 'description = ?', data.description, (value) => value.trim());
    appendOptionalUpdate(updates, values, 'is_public = ?', data.isPublic, (value) => (value ? 1 : 0));
    appendOptionalUpdate(updates, values, 'password = ?', data.password, (value) => value || null);
    if (data.parentId !== undefined) {
      if (data.parentId) {
        const isDescendant = await folderRepo.isDescendantOrSelf(folderId, data.parentId);
        if (isDescendant) {
          throw new BadRequestError(MSG.FOLDER.MOVE_TO_SELF);
        }
      }
      appendOptionalUpdate(updates, values, 'parent_id = ?', data.parentId);
    }
    appendOptionalUpdate(updates, values, 'share_expires_at = ?', data.shareExpiresAt);

    // 自动生成分享令牌
    if ((data.isPublic === true || data.shareExpiresAt !== undefined) && !folder.share_token) {
      updates.push('share_token = ?');
      values.push(generateShareToken());
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(folderId);

    const updated = await folderRepo.update(folderId, updates, values);

    await publishSingleDomainEventAndPoll(c, {
      event_type: 'folder_updated',
      aggregate_type: 'folder',
      aggregate_id: folderId,
      payload: {
        folder_id: folderId,
      },
    }, `folder-update:${folderId}`);
    scheduleAuditEvent(c, {
      domain: 'folders',
      action: 'folder.update',
      result: 'success',
      severity: 'high',
      targetType: 'folder',
      targetId: folderId,
      target_label: updated.name || folderId,
      summary: `Updated folder ${updated.name || folderId}`,
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
 * DELETE /api/manage/folders/:id - 移入回收站
 */
app.delete('/:id', requirePermission('folders:delete'), async (c) => {
  const { env } = c;
  const folderId = c.req.param('id');
  const folderRepo = new FolderRepository(env.DB);

  if (folderId === 'root') throw new BadRequestError(MSG.FOLDER.ROOT_CANNOT_DELETE);

  const folder = await requireFolder(folderRepo, folderId);

  if (folder.is_system) throw new ForbiddenError(MSG.FOLDER.SYSTEM_FOLDER_DELETE);

  // 软删除
  await folderRepo.softDelete(folderId);

  await publishSingleDomainEventAndPoll(c, {
    event_type: 'folder_deleted',
    aggregate_type: 'folder',
    aggregate_id: folderId,
    payload: {
      folder_id: folderId,
    },
  }, `folder-delete:${folderId}`);
  scheduleAuditEvent(c, {
    domain: 'folders',
    action: 'folder.delete',
    result: 'success',
    severity: 'critical',
    targetType: 'folder',
    targetId: folderId,
    target_label: folder.name,
    summary: `Deleted folder ${folder.name}`,
  });

  return c.json({ success: true, message: MSG.FOLDER.DELETE_SUCCESS });
});

import { storeFile } from '../../../../api/utils/file-utils.js';

/**
 * POST /api/manage/folders/:id/upload - 上传文件到文件夹
 */
app.post('/:id/upload', requirePermission('files:write'), async (c) => {
  const folderId = c.req.param('id');
  const { env } = c;
  const user = c.get('user');
  const folderRepo = new FolderRepository(env.DB);

  // 1. 验证文件夹是否存在
  const folder = await requireFolder(folderRepo, folderId);

  // 2. 获取上传文件
  const formData = await c.req.parseBody();
  const uploadFile = formData['file'];

  if (!uploadFile) throw new BadRequestError(MSG.COMMON.UPLOAD_NO_FILE);

  // 3. 获取前端提供的哈希（如果有）
  const url = new URL(c.req.url);
  const contentHash = url.searchParams.get('contentHash');
  const originalHash = url.searchParams.get('originalHash');

  // 4. 使用统一的 storeFile 处理上传
  const result = await storeFile(env, uploadFile, {
    contentHash,
    originalHash,
    folderId,
    createdBy: user.id,
  });
  scheduleAuditEvent(c, {
    domain: 'folders',
    action: 'folder.upload',
    result: 'success',
    severity: 'normal',
    targetType: 'folder',
    targetId: folderId,
    target_label: folder.name,
    summary: `Uploaded file into folder ${folder.name}`,
    metadata: { fileId: result?.id || null },
  });

  await publishSingleDomainEventAndPoll(c, {
    event_type: 'file_uploaded',
    aggregate_type: 'file',
    aggregate_id: result.id,
    payload: {
      file: {
        id: result.id,
        filename: result.name,
        size: result.size,
        type: result.type,
        uploadTime: timestampToIso(Date.now()),
        url: getFileUrl(result.storageKey),
        uploader: user.name || user.username || user.id,
      },
      user,
    },
  }, `file-uploaded:${result.id}`);

  return c.json({
    success: true,
    message: result.instantUpload ? MSG.FILE.INSTANT_UPLOAD : MSG.FILE.UPLOAD_SUCCESS,
    data: {
      id: result.id,
      name: result.name,
      url: `/file/${result.storageKey}`,
      src: `/file/${result.storageKey}`, // 兼容旧前端
      instantUpload: result.instantUpload,
    },
  });
});

export default app;
