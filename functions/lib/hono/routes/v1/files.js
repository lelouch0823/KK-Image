import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  FileQuerySchema,
  CreateFileSchema,
  BatchFileSchema,
  MoveFileSchema,
} from '../../schemas/file.js';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';
import { getFileUrl, generateId, MSG } from '../../_shared/utils.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../errors.js';
import { requireEntity } from '../../_shared/route-helpers.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishSingleDomainEventAndPoll } from '../../_shared/domain-outbox.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'POST', path: '/', domain: 'v1-files', action: 'v1.file.create', severity: 'normal', targetType: 'file' },
  { method: 'PUT', path: '/:id', domain: 'v1-files', action: 'v1.file.update', severity: 'normal', targetType: 'file' },
  { method: 'DELETE', path: '/:id', domain: 'v1-files', action: 'v1.file.delete', severity: 'high', targetType: 'file' },
  { method: 'POST', path: '/batch/delete', domain: 'v1-files', action: 'v1.file.batch_delete', severity: 'high', targetType: 'file' },
  { method: 'POST', path: '/batch/move', domain: 'v1-files', action: 'v1.file.batch_move', severity: 'high', targetType: 'file' },
]);

/** sort 列名白名单 - 二次防御 SQL 注入 */
const ALLOWED_SORT_COLUMNS = {
  created_at: 'created_at',
  name: 'name',
  size: 'size',
  updated_at: 'updated_at',
};

async function assertTargetFolderExists(folderRepo, targetFolderId) {
  if (!targetFolderId || targetFolderId === 'root') return;
  await requireEntity(folderRepo.findById(targetFolderId), () => new NotFoundError(MSG.FOLDER.NOT_FOUND));
}

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
  const file = await requireEntity(
    repo.findById(id),
    () => new NotFoundError(MSG.FILE.NOT_FOUND)
  );

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

  if (data.name) {
    const hasConflict = await repo.checkNameConflict(data.folderId || null, data.name.trim());
    if (hasConflict) throw new ConflictError(MSG.FILE.NAME_CONFLICT || "当前目录下已存在同名文件");
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
    updatedAt: nowMs
  });

  await publishSingleDomainEventAndPoll(c, {
    event_type: 'v1_file_created',
    aggregate_type: 'file',
    aggregate_id: id,
    payload: {
      file_id: id,
      folder_ids: [data.folderId || null],
    },
  }, `v1-file-create:${id}`);
  scheduleAuditEvent(c, {
    domain: 'v1-files',
    action: 'v1.file.create',
    result: 'success',
    severity: 'normal',
    targetType: 'file',
    targetId: id,
    target_label: data.name.trim(),
    summary: `Created file record ${data.name.trim()}`,
  });

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
  const file = await requireEntity(
    repo.findById(id),
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
      const hasConflict = await repo.checkNameConflict(checkFolderId, checkName, id);
      if (hasConflict) throw new ConflictError(MSG.FILE.NAME_CONFLICT || "当前目录下已存在同名文件");
    }
  }

  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.folderId !== undefined) updates.folder_id = data.folderId;
  if (data.isPublic !== undefined) updates.is_public = data.isPublic ? 1 : 0;

  if (Object.keys(updates).length === 0) {
    throw new BadRequestError(MSG.COMMON.NO_UPDATE_FIELDS);
  }

  await repo.update(id, updates);
  await publishSingleDomainEventAndPoll(c, {
    event_type: 'v1_file_updated',
    aggregate_type: 'file',
    aggregate_id: id,
    payload: {
      file_id: id,
      folder_ids: [file.folder_id, checkFolderId].filter((value) => value !== undefined),
    },
  }, `v1-file-update:${id}`);
  scheduleAuditEvent(c, {
    domain: 'v1-files',
    action: 'v1.file.update',
    result: 'success',
    severity: 'normal',
    targetType: 'file',
    targetId: id,
    target_label: updates.name || file.name,
    summary: `Updated file ${updates.name || file.name}`,
  });

  return c.json({ success: true, message: MSG.FILE.UPDATE_SUCCESS });
});

/**
 * DELETE /api/v1/files/:id - 删除文件
 */
app.delete('/:id', requirePermission('files:delete'), async (c) => {
  const id = c.req.param('id');
  const { env } = c;

  const repo = new FileRepository(env.DB);
  const file = await requireEntity(
    repo.findById(id),
    () => new NotFoundError(MSG.FILE.NOT_FOUND)
  );

  // 软删除 (Recycle Bin)
  await repo.softDelete(id);

  await publishSingleDomainEventAndPoll(c, {
    event_type: 'v1_file_deleted',
    aggregate_type: 'file',
    aggregate_id: id,
    payload: {
      file_id: id,
      folder_ids: [file.folder_id],
    },
  }, `v1-file-delete:${id}`);
  scheduleAuditEvent(c, {
    domain: 'v1-files',
    action: 'v1.file.delete',
    result: 'success',
    severity: 'high',
    targetType: 'file',
    targetId: id,
    target_label: file.name,
    summary: `Deleted file ${file.name}`,
  });

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

    // 先读取所在目录，再软删除，保证目录详情缓存能被精准失效
    const targetFiles = await repo.findByIds(ids);

    // 软删除
    await repo.softDeleteBatch(ids);

    await publishSingleDomainEventAndPoll(c, {
      event_type: 'v1_file_batch_deleted',
      aggregate_type: 'file',
      aggregate_id: ids[0] || 'batch',
      payload: {
        file_ids: ids,
        folder_ids: targetFiles.map((item) => item.folder_id),
      },
    }, `v1-file-batch-delete:${ids.length}`);
    scheduleAuditEvent(c, {
      domain: 'v1-files',
      action: 'v1.file.batch_delete',
      result: 'success',
      severity: 'high',
      targetType: 'file',
      summary: `Batch deleted ${ids.length} files`,
      metadata: { count: ids.length },
    });

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
    await assertTargetFolderExists(folderRepo, targetFolderId);

    // 批量重名检查
    const targetFiles = await fileRepo.findByIds(ids);
    const validNames = targetFiles.map(f => f.name);

    if (validNames.length > 0) {
      const conflicts = await fileRepo.findConflictingNames(targetFolderId || 'root', validNames);
      if (conflicts.length > 0) {
        throw new ConflictError(`目标目录下已存在同名文件: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? ' 等' : ''}`);
      }
    }

    const sourceFolderIds = targetFiles.map((item) => item.folder_id);

    await fileRepo.moveBatch(ids, targetFolderId || 'root');
    await publishSingleDomainEventAndPoll(c, {
      event_type: 'v1_file_batch_moved',
      aggregate_type: 'file',
      aggregate_id: ids[0] || 'batch',
      payload: {
        file_ids: ids,
        folder_ids: [...sourceFolderIds, targetFolderId],
      },
    }, `v1-file-batch-move:${ids.length}`);
    scheduleAuditEvent(c, {
      domain: 'v1-files',
      action: 'v1.file.batch_move',
      result: 'success',
      severity: 'high',
      targetType: 'file',
      summary: `Batch moved ${ids.length} files`,
      metadata: { count: ids.length, targetFolderId: targetFolderId || 'root' },
    });

    return c.json({
      success: true,
      message: MSG.FILE.MOVE_SUCCESS.replace('{count}', ids.length),
    });
  }
);

export default app;
