import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { getFileUrl, MSG } from '../../_shared/utils.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { logAudit, getAuditContext } from '../../../../api/utils/audit.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { NotFoundError, ConflictError } from '../../errors.js';
import { parsePagination, requireEntity } from '../../_shared/route-helpers.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  { method: 'PUT', path: '/:id', domain: 'files', action: 'file.rename', severity: 'normal', targetType: 'file' },
  { method: 'DELETE', path: '/:id', domain: 'files', action: 'file.delete', severity: 'high', targetType: 'file' },
  { method: 'POST', path: '/batch/delete', domain: 'files', action: 'file.batch_delete', severity: 'high', targetType: 'file' },
  { method: 'POST', path: '/batch/move', domain: 'files', action: 'file.batch_move', severity: 'high', targetType: 'file' },
]);
app.use('*', requirePermission('files:read'));

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

async function requireFile(repo, fileId) {
  return requireEntity(repo.findById(fileId), () => new NotFoundError(MSG.FILE.NOT_FOUND));
}

async function assertTargetFolderExists(db, targetFolderId) {
  if (!targetFolderId || targetFolderId === 'root') return;
  const folderRepo = new FolderRepository(db);
  await requireEntity(folderRepo.findById(targetFolderId), () => new NotFoundError(MSG.FOLDER.NOT_FOUND));
}

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
  const { page, limit } = parsePagination(c, { limit: 50 });

  const repo = new FileRepository(env.DB);
  const filter = folderId ? { folderId } : { rootOnly: true };
  const result = await repo.findAll(filter, { page, limit });

  return c.json({
    success: true,
    data: result.items.map(toFileListItem),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
});

/**
 * GET /api/manage/files/:id - 获取单个文件详情
 */
app.get('/:id', async (c) => {
  const { env } = c;
  const fileId = c.req.param('id');

  const repo = new FileRepository(env.DB);
  const file = await requireFile(repo, fileId);

  return c.json({
    success: true,
    data: toFileDetail(file),
  });
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

    const repo = new FileRepository(env.DB);
    const file = await requireFile(repo, fileId);

    if (name.trim() !== file.name) {
      const hasConflict = await repo.checkNameConflict(file.folder_id, name.trim(), fileId);
      if (hasConflict) throw new ConflictError(MSG.FILE.NAME_CONFLICT || "当前目录下已存在同名文件");
    }

    await repo.update(fileId, { name: name.trim() });
    scheduleAuditEvent(c, {
      domain: 'files',
      action: 'file.rename',
      result: 'success',
      severity: 'normal',
      targetType: 'file',
      targetId: fileId,
      target_label: name.trim(),
      summary: `Renamed file ${file.name} to ${name.trim()}`,
      metadata: { previousName: file.name, nextName: name.trim() },
    });
    return c.json({ success: true, message: MSG.FILE.RENAME_SUCCESS });
  }
);

/**
 * DELETE /api/manage/files/:id - 移入回收站
 */
app.delete('/:id', requirePermission('files:delete'), async (c) => {
  const { env } = c;
  const fileId = c.req.param('id');

  const repo = new FileRepository(env.DB);
  const file = await requireFile(repo, fileId);

  // 软删除
  await repo.softDelete(fileId);

  // 审计日志 (SOTA: 非阻塞记录)
  const { userId, ip } = getAuditContext(c);
  c.executionCtx.waitUntil(logAudit(env.DB, { userId, action: 'files:delete', targetType: 'file', targetId: fileId, payload: { name: file.name }, ip }));
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
    // SOTA: 软删除
    await repo.softDeleteBatch(ids);

    // 审计日志 (SOTA: 非阻塞记录)
    const { userId, ip } = getAuditContext(c);
    c.executionCtx.waitUntil(logAudit(env.DB, { userId, action: 'files:batch_delete', targetType: 'file', payload: { ids }, ip }));
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
    const validNames = targetFiles.map(f => f.name);

    if (validNames.length > 0) {
      const conflicts = await repo.findConflictingNames(targetFolderId || 'root', validNames);
      if (conflicts.length > 0) {
        throw new ConflictError(`目标目录下已存在同名文件: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? ' 等' : ''}`);
      }
    }

    await repo.moveBatch(ids, targetFolderId || 'root');
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
