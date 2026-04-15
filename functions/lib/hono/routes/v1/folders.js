import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  FolderQuerySchema,
  CreateFolderSchema,
  UpdateFolderSchema,
  ShareSettingsSchema,
} from '../../schemas/folder.js';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';
import { generateId, generateShareToken, getFileUrl, now, MSG } from '../../../../_shared/utils.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../errors.js';
import { appendOptionalUpdate, requireEntity } from '../../_shared/route-helpers.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/', domain: 'v1-folders', action: 'v1.folder.create', severity: 'high', targetType: 'folder' },
  { method: 'PUT', path: '/:id', domain: 'v1-folders', action: 'v1.folder.update', severity: 'high', targetType: 'folder' },
  { method: 'DELETE', path: '/:id', domain: 'v1-folders', action: 'v1.folder.delete', severity: 'critical', targetType: 'folder' },
  { method: 'PUT', path: '/:id/share', domain: 'v1-folders', action: 'v1.folder.share_update', severity: 'high', targetType: 'folder' },
]);

function toSafeFolder(folder) {
  return {
    id: folder.id,
    parentId: folder.parent_id || null,
    name: folder.name,
    description: folder.description || '',
    isPublic: Boolean(folder.is_public),
    hasPassword: Boolean(folder.password),
    shareExpiresAt: folder.share_expires_at || null,
    createdAt: folder.created_at || null,
    updatedAt: folder.updated_at || null,
    subfolderCount: folder.subfolderCount ?? folder.subfolder_count ?? 0,
    fileCount: folder.fileCount ?? folder.file_count ?? 0,
  };
}

/**
 * GET /api/v1/folders - 获取文件夹列表
 * SOTA: 使用 Repository 的 list() 方法，通过 JOIN 消除 N+1 查询
 */
app.get('/', requirePermission('folders:read'), zValidator('query', FolderQuerySchema), withCache(30), async (c) => {
  const { page, limit, parentId, search } = c.req.valid('query');
  const repo = new FolderRepository(c.env.DB);

  const result = await repo.list({ parentId, search, page, limit });

  return c.json({
    success: true,
    data: result.items.map((item) => toSafeFolder(item)),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
});

/**
 * GET /api/v1/folders/:id - 获取单个文件夹详情
 */
app.get('/:id', requirePermission('folders:read'), withCache(60), async (c) => {
  const id = c.req.param('id');
  const repo = new FolderRepository(c.env.DB);

  const detail = await requireEntity(
    repo.findDetail(id),
    () => new NotFoundError(MSG.FOLDER.NOT_FOUND)
  );

  return c.json({
    success: true,
    data: {
      ...toSafeFolder(detail.folder),
      files: detail.files.map((file) => ({
        id: file.id,
        name: file.name,
        originalName: file.original_name || null,
        size: file.size,
        mimeType: file.mime_type || null,
        createdAt: file.created_at || null,
        url: getFileUrl(file.id || file.storage_key),
      })),
      subfolders: detail.subfolders.map((folder) => toSafeFolder(folder)),
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
    const repo = new FolderRepository(c.env.DB);

    // 验证父文件夹存在
    if (data.parentId) {
      await requireEntity(
        repo.findById(data.parentId),
        () => new NotFoundError(MSG.FOLDER.PARENT_NOT_FOUND)
      );
    }

    const hasConflict = await repo.checkNameConflict(data.parentId || null, data.name.trim());
    if (hasConflict) throw new ConflictError(MSG.FOLDER.NAME_CONFLICT || "当前目录下已存在同名文件夹");

    const id = generateId();
    const shareToken = generateShareToken(16);
    const timestamp = now();

    await repo.create({
      id,
      name: data.name,
      parentId: data.parentId || null,
      description: data.description || null,
      isPublic: data.isPublic,
      password: data.password || null,
      shareToken,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await publishSingleDomainEventAndPoll(c, {
      event_type: 'v1_folder_created',
      aggregate_type: 'folder',
      aggregate_id: id,
      payload: {
        folder_id: id,
        parent_ids: [data.parentId || null],
      },
    }, `v1-folder-create:${id}`);
    scheduleAuditEvent(c, {
      domain: 'v1-folders',
      action: 'v1.folder.create',
      result: 'success',
      severity: 'high',
      targetType: 'folder',
      targetId: id,
      target_label: data.name,
      summary: `Created folder ${data.name}`,
    });

    return c.json(
      { success: true, data: { id, shareToken, ...data, createdAt: timestamp } },
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
    const repo = new FolderRepository(c.env.DB);

    const folder = await requireEntity(
      repo.findById(id),
      () => new NotFoundError(MSG.FOLDER.NOT_FOUND)
    );

    // 判断是否需要进行重名校验
    let checkParentId = folder.parent_id;
    let checkName = folder.name;
    if (data.parentId !== undefined) checkParentId = data.parentId || null;
    if (data.name !== undefined) checkName = data.name.trim();

    if (data.name !== undefined || data.parentId !== undefined) {
      if (checkParentId !== folder.parent_id || checkName !== folder.name) {
        const hasConflict = await repo.checkNameConflict(checkParentId, checkName, id);
        if (hasConflict) throw new ConflictError(MSG.FOLDER.NAME_CONFLICT || "在目标目录下已存在同名文件夹");
      }
    }

    const updates = [];
    const values = [];
    appendOptionalUpdate(updates, values, 'name = ?', data.name);
    appendOptionalUpdate(updates, values, 'description = ?', data.description);
    appendOptionalUpdate(updates, values, 'is_public = ?', data.isPublic, (value) => (value ? 1 : 0));
    appendOptionalUpdate(updates, values, 'password = ?', data.password);
    if (data.parentId !== undefined) {
      if (data.parentId) {
        const isDescendant = await repo.isDescendantOrSelf(id, data.parentId);
        if (isDescendant) throw new BadRequestError(MSG.FOLDER.MOVE_TO_SELF);
      }
      appendOptionalUpdate(updates, values, 'parent_id = ?', data.parentId);
    }
    appendOptionalUpdate(updates, values, 'share_expires_at = ?', data.shareExpiresAt);

    if (updates.length === 0) throw new BadRequestError(MSG.COMMON.NO_UPDATE_FIELDS);

    updates.push('updated_at = ?');
    values.push(now());

    await repo.update(id, updates, values);

    await publishSingleDomainEventAndPoll(c, {
      event_type: 'v1_folder_updated',
      aggregate_type: 'folder',
      aggregate_id: id,
      payload: {
        folder_id: id,
        parent_ids: [folder.parent_id, checkParentId, id].filter((value) => value !== undefined),
      },
    }, `v1-folder-update:${id}`);
    scheduleAuditEvent(c, {
      domain: 'v1-folders',
      action: 'v1.folder.update',
      result: 'success',
      severity: 'high',
      targetType: 'folder',
      targetId: id,
      target_label: data.name || folder.name,
      summary: `Updated folder ${data.name || folder.name}`,
    });

    return c.json({ success: true, message: MSG.FOLDER.UPDATE_SUCCESS });
  }
);

/**
 * DELETE /api/v1/folders/:id - 删除文件夹
 */
app.delete('/:id', requirePermission('folders:delete'), async (c) => {
  const id = c.req.param('id');
  const repo = new FolderRepository(c.env.DB);

  const folder = await requireEntity(
    repo.findById(id),
    () => new NotFoundError(MSG.FOLDER.NOT_FOUND)
  );

  // SOTA: 使用 Repository 封装的 canDelete 检查
  const { canDelete } = await repo.canDelete(id);
  if (!canDelete) {
    throw new BadRequestError(MSG.FOLDER.EMPTY_INVALID);
  }

  await repo.softDelete(id);
  await publishSingleDomainEventAndPoll(c, {
    event_type: 'v1_folder_deleted',
    aggregate_type: 'folder',
    aggregate_id: id,
    payload: {
      folder_id: id,
      parent_ids: [folder.parent_id, id].filter((value) => value !== undefined),
    },
  }, `v1-folder-delete:${id}`);
  scheduleAuditEvent(c, {
    domain: 'v1-folders',
    action: 'v1.folder.delete',
    result: 'success',
    severity: 'critical',
    targetType: 'folder',
    targetId: id,
    target_label: folder.name,
    summary: `Deleted folder ${folder.name}`,
  });

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
    const repo = new FolderRepository(c.env.DB);

    // SOTA: 使用 Repository 封装的分享设置更新
    const shareInfo = await repo.updateShareSettings(id, { isPublic, password, expiresAt });

    await publishSingleDomainEventAndPoll(c, {
      event_type: 'v1_folder_share_updated',
      aggregate_type: 'folder',
      aggregate_id: id,
      payload: {
        folder_id: id,
        parent_ids: [id],
      },
    }, `v1-folder-share:${id}`);
    scheduleAuditEvent(c, {
      domain: 'v1-folders',
      action: 'v1.folder.share_update',
      result: 'success',
      severity: 'high',
      targetType: 'folder',
      targetId: id,
      target_label: id,
      summary: `Updated folder share settings ${id}`,
    });

    return c.json({
      success: true,
      data: {
        shareToken: shareInfo?.share_token,
        isPublic: !!shareInfo?.is_public,
        hasPassword: !!shareInfo?.password,
        expiresAt: shareInfo?.share_expires_at,
      },
    });
  }
);

export default app;
