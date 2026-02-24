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
import { NotFoundError, BadRequestError, ConflictError } from '../../errors.js';

const app = new Hono();

const getFolderCacheUrls = createCacheInvalidator('/api/v1/folders', ['parentId=null']);

/**
 * GET /api/v1/folders - 获取文件夹列表
 * SOTA: 使用 Repository 的 list() 方法，通过 JOIN 消除 N+1 查询
 */
app.get('/', zValidator('query', FolderQuerySchema), withCache(30), async (c) => {
  const { page, limit, parentId, search } = c.req.valid('query');
  const repo = new FolderRepository(c.env.DB);

  const result = await repo.list({ parentId, search, page, limit });

  return c.json({
    success: true,
    data: result.items,
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
app.get('/:id', withCache(60), async (c) => {
  const id = c.req.param('id');
  const repo = new FolderRepository(c.env.DB);

  const detail = await repo.findDetail(id);
  if (!detail) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

  return c.json({
    success: true,
    data: {
      ...detail.folder,
      files: detail.files,
      subfolders: detail.subfolders,
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
      const parent = await repo.findById(data.parentId);
      if (!parent) throw new NotFoundError(MSG.FOLDER.PARENT_NOT_FOUND);
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

    c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

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

    const folder = await repo.findById(id);
    if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

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

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (key === 'parentId' && value) {
          const isDescendant = await repo.isDescendantOrSelf(id, value);
          if (isDescendant) throw new BadRequestError(MSG.FOLDER.MOVE_TO_SELF);
        }
        const dbKey = key === 'isPublic' ? 'is_public' : key === 'parentId' ? 'parent_id' : key;
        updates.push(`${dbKey} = ?`);
        values.push(key === 'isPublic' ? (value ? 1 : 0) : value);
      }
    }

    if (updates.length === 0) throw new BadRequestError(MSG.COMMON.NO_UPDATE_FIELDS);

    updates.push('updated_at = ?');
    values.push(now());

    await repo.update(id, updates, values);

    c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

    return c.json({ success: true, message: MSG.FOLDER.UPDATE_SUCCESS });
  }
);

/**
 * DELETE /api/v1/folders/:id - 删除文件夹
 */
app.delete('/:id', requirePermission('folders:delete'), async (c) => {
  const id = c.req.param('id');
  const repo = new FolderRepository(c.env.DB);

  const folder = await repo.findById(id);
  if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

  // SOTA: 使用 Repository 封装的 canDelete 检查
  const { canDelete } = await repo.canDelete(id);
  if (!canDelete) {
    throw new BadRequestError(MSG.FOLDER.EMPTY_INVALID);
  }

  await repo.softDelete(id);
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
    const repo = new FolderRepository(c.env.DB);

    // SOTA: 使用 Repository 封装的分享设置更新
    const shareInfo = await repo.updateShareSettings(id, { isPublic, password, expiresAt });

    c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

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
