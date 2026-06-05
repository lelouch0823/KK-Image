import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';
import { getFileUrl, generateId, MSG } from '../../../../_shared/utils.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../errors.js';
import { requireEntity } from '../../_shared/route-helpers.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';
import {
  DeleteFilesSchema,
  MoveFilesSchema,
  FileQuerySchema,
  CreateFileSchema,
} from '../../schemas/file.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/', domain: 'files', action: 'file.create', severity: 'normal', targetType: 'file' },
  { method: 'PUT', path: '/:id', domain: 'files', action: 'file.update', severity: 'normal', targetType: 'file' },
  { method: 'DELETE', path: '/:id', domain: 'files', action: 'file.delete', severity: 'high', targetType: 'file' },
  { method: 'POST', path: '/batch/delete', domain: 'files', action: 'file.batch_delete', severity: 'high', targetType: 'file' },
  { method: 'POST', path: '/batch/move', domain: 'files', action: 'file.batch_move', severity: 'high', targetType: 'file' },
]);
app.use('*', requirePermission('files:read'));

/** sort 列名白名单 - 二次防御 SQL 注入 */
const ALLOWED_SORT_COLUMNS = {
  created_at: 'created_at',
  name: 'name',
  size: 'size',
  updated_at: 'updated_at',
};

function toFileListItem(file) {
  return {
    id: file.id,
    name: file.name,
    originalName: file.original_name,
    size: file.size,
    mimeType: file.mime_type,
    url: getFileUrl(file.storage_key),
    folderId: file.folder_id,
    createdAt: file.created_at,
  };
}

function toFileDetail(file) {
  return {
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
  };
}

async function assertTargetFolderExists(db, targetFolderId) {
  if (!targetFolderId || targetFolderId === 'root') return;
  const folderRepo = new FolderRepository(db);
  await requireEntity(folderRepo.findById(targetFolderId), () => new NotFoundError(MSG.FOLDER.NOT_FOUND));
}

/**
 * GET /api/manage/files - 获取文件列表
 * 支持高级过滤: search, type, isPublic, sort, order
 */
app.get('/', zValidator('query', FileQuerySchema), withCache(30), async (c) => {
  const { env } = c;
  const { page, limit, sort, order, folderId, search, type, isPublic } = c.req.valid('query');

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
    data: results.map(toFileListItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * POST /api/manage/files/check-hash - 预检查 (original_hash) 用于秒传
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
          mimeType: existingFile.mime_type,
          size: existingFile.size,
          instantUpload: true,
        },
      },
      message: MSG.FILE.INSTANT_UPLOAD,
    });
  }

  return c.json({ success: true, data: { exists: false } });
});

/**
 * GET /api/manage/files/:id - 获取单个文件详情
 */
app.get('/:id', withCache(60), async (c) => {
  const { env } = c;
  const fileId = c.req.param('id');

  const repo = new FileRepository(env.DB);
  const file = await requireEntity(
    repo.findById(fileId),
    () => new NotFoundError(MSG.FILE.NOT_FOUND)
  );

  return c.json({
    success: true,
    data: toFileDetail(file),
  });
});

/**
 * POST /api/manage/files - 创建文件记录
 */
app.post(
  '/',
  requirePermission('files:write'),
  zValidator('json', CreateFileSchema),
  async (c) => {
    const data = c.req.valid('json');
    const user = c.get('user');
    const { env } = c;

    const repo = new FileRepository(env.DB);

    if (data.name) {
      const hasConflict = await repo.checkNameConflict(data.folderId || null, data.name.trim());
      if (hasConflict) throw new ConflictError(MSG.FILE.NAME_CONFLICT || '当前目录下已存在同名文件');
    }

    const id = generateId();
    const nowMs = Date.now();

    await repo.create({
      id,
      name: data.name.trim(),
      folderId: data.folderId,
      isPublic: data.isPublic,
      storageKey: id,
      createdBy: user.id,
      createdAt: nowMs,
      updatedAt: nowMs,
    });

    await publishSingleDomainEventAndPoll(c, {
      event_type: 'file_created',
      aggregate_type: 'file',
      aggregate_id: id,
      payload: {
        file_id: id,
        folder_ids: [data.folderId || null],
      },
    }, `file-create:${id}`);
    scheduleAuditEvent(c, {
      domain: 'files',
      action: 'file.create',
      result: 'success',
      severity: 'normal',
      targetType: 'file',
      targetId: id,
      target_label: data.name.trim(),
      summary: `Created file record ${data.name.trim()}`,
    });

    return c.json({ success: true, data: { id, ...data, createdAt: nowMs } }, 201);
  }
);

/**
 * PUT /api/manage/files/:id - 更新文件（支持重命名、移动、设置公开状态）
 */
app.put(
  '/:id',
  requirePermission('files:write'),
  async (c) => {
    const { env } = c;
    const fileId = c.req.param('id');
    const data = await c.req.json();

    const repo = new FileRepository(env.DB);
    const file = await requireEntity(
      repo.findById(fileId),
      () => new NotFoundError(MSG.FILE.NOT_FOUND)
    );

    const updates = {};

    // 重名冲突检查
    let checkFolderId = file.folder_id;
    let checkName = file.name;
    if (data.folderId !== undefined) checkFolderId = data.folderId || null;
    if (data.name !== undefined) checkName = data.name.trim();

    if (data.name !== undefined || data.folderId !== undefined) {
      if (checkFolderId !== file.folder_id || checkName !== file.name) {
        const hasConflict = await repo.checkNameConflict(checkFolderId, checkName, fileId);
        if (hasConflict) throw new ConflictError(MSG.FILE.NAME_CONFLICT || '当前目录下已存在同名文件');
      }
    }

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.folderId !== undefined) updates.folder_id = data.folderId;
    if (data.isPublic !== undefined) updates.is_public = data.isPublic ? 1 : 0;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestError(MSG.COMMON.NO_UPDATE_FIELDS);
    }

    await repo.update(fileId, updates);
    await publishSingleDomainEventAndPoll(c, {
      event_type: 'file_updated',
      aggregate_type: 'file',
      aggregate_id: fileId,
      payload: {
        file_id: fileId,
        folder_ids: [...new Set([file.folder_id, checkFolderId].filter((v) => v !== undefined))],
      },
    }, `file-update:${fileId}`);
    scheduleAuditEvent(c, {
      domain: 'files',
      action: 'file.update',
      result: 'success',
      severity: 'normal',
      targetType: 'file',
      targetId: fileId,
      target_label: updates.name || file.name,
      summary: `Updated file ${updates.name || file.name}`,
      metadata: { previousName: file.name, nextName: updates.name || file.name },
    });

    return c.json({ success: true, message: MSG.FILE.UPDATE_SUCCESS });
  }
);

/**
 * DELETE /api/manage/files/:id - 移入回收站
 */
app.delete('/:id', requirePermission('files:delete'), async (c) => {
  const { env } = c;
  const fileId = c.req.param('id');

  const repo = new FileRepository(env.DB);
  const file = await requireEntity(
    repo.findById(fileId),
    () => new NotFoundError(MSG.FILE.NOT_FOUND)
  );

  // 软删除
  await repo.softDelete(fileId);
  await publishSingleDomainEventAndPoll(c, {
    event_type: 'file_deleted',
    aggregate_type: 'file',
    aggregate_id: fileId,
    payload: {
      file_id: fileId,
      folder_ids: [file.folder_id],
    },
  }, `file-delete:${fileId}`);
  scheduleAuditEvent(c, {
    domain: 'files',
    action: 'file.delete',
    result: 'success',
    severity: 'high',
    targetType: 'file',
    targetId: fileId,
    target_label: file.name,
    summary: `Deleted file ${file.name}`,
    metadata: { name: file.name },
  });

  return c.json({ success: true, message: MSG.FILE.DELETE_SUCCESS });
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

    const repo = new FileRepository(env.DB);
    const targetFiles = await repo.findByIds(ids);
    // SOTA: 软删除
    await repo.softDeleteBatch(ids);
    await publishSingleDomainEventAndPoll(c, {
      event_type: 'file_batch_deleted',
      aggregate_type: 'file',
      aggregate_id: ids[0] || 'batch',
      payload: {
        file_ids: ids,
        folder_ids: targetFiles.map((item) => item.folder_id),
      },
    }, `file-batch-delete:${ids.length}`);
    scheduleAuditEvent(c, {
      domain: 'files',
      action: 'file.batch_delete',
      result: 'success',
      severity: 'high',
      targetType: 'file',
      summary: `Batch deleted ${ids.length} files`,
      metadata: { ids, count: ids.length },
    });
    return c.json({ success: true, message: MSG.FILE.BATCH_DELETE_SUCCESS.replace('{count}', ids.length) });
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

    await assertTargetFolderExists(env.DB, targetFolderId);

    const repo = new FileRepository(env.DB);

    // 获取要移动的文件记录以提取原名
    const targetFiles = await repo.findByIds(ids);
    const validNames = targetFiles.map((f) => f.name);

    if (validNames.length > 0) {
      const conflicts = await repo.findConflictingNames(targetFolderId || 'root', validNames);
      if (conflicts.length > 0) {
        throw new ConflictError(`目标目录下已存在同名文件: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? ' 等' : ''}`);
      }
    }

    const sourceFolderIds = targetFiles.map((file) => file.folder_id);
    await repo.moveBatch(ids, targetFolderId || 'root');
    await publishSingleDomainEventAndPoll(c, {
      event_type: 'file_batch_moved',
      aggregate_type: 'file',
      aggregate_id: ids[0] || 'batch',
      payload: {
        file_ids: ids,
        folder_ids: [...sourceFolderIds, targetFolderId || 'root'],
      },
    }, `file-batch-move:${ids.length}`);
    scheduleAuditEvent(c, {
      domain: 'files',
      action: 'file.batch_move',
      result: 'success',
      severity: 'high',
      targetType: 'file',
      summary: `Moved ${ids.length} files`,
      metadata: { ids, targetFolderId: targetFolderId || 'root' },
    });

    return c.json({ success: true, message: MSG.FILE.MOVE_SUCCESS.replace('{count}', ids.length) });
  }
);

export default app;
