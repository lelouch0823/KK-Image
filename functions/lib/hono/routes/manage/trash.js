import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requirePermission } from '../../middleware/auth.js';
import { getFileUrl, MSG } from '../../../../_shared/utils.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { decrementRefCount } from '../../../../api/utils/blob-utils.js';
import { StorageMirrorRepository } from '../../../../repositories/StorageMirrorRepository.js';
import { getStorageProvider } from '../../../../storage/index.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishDomainEventsAndPoll } from '../../_shared/domain-outbox.js';
import { withCache } from '../../middleware/cache.js';
import { chunkArray } from '../../../../lib/db/batch.js';
import { D1_MAX_IN_CLAUSE_SIZE } from '../../../../api/utils/constants.js';
import { RestoreSchema, DeleteTrashSchema } from '../../schemas/trash.js';

/**
 * B-M6：彻底删除时同步清理 storage_mirrors 记录与镜像副本。
 * 镜像子系统当前未在生产启用（无写入方），但清理逻辑必须先行到位：
 * 一旦镜像启用，遗漏清理即成"已删文件仍可从镜像 GET"的数据泄漏。
 * R2 删除失败时中止 DB 删除并抛错（避免孤儿对象 + 台账消失的不可逆组合）。
 */
async function purgeStorageMirrors(env, fileIds) {
  if (!fileIds?.length) return;
  const mirrorRepo = new StorageMirrorRepository(env.DB);
  for (const fileId of fileIds) {
    const mirrors = await mirrorRepo.findByFileId(fileId);
    for (const mirror of mirrors) {
      const provider = getStorageProvider(env, mirror.provider);
      if (provider && mirror.provider_file_id) {
        await provider.delete(mirror.provider_file_id).catch((err) =>
          console.warn('[Trash] mirror delete failed:', mirror.provider, err?.message)
        );
      }
    }
    await env.DB.prepare('DELETE FROM storage_mirrors WHERE file_id = ?').bind(fileId).run();
  }
}

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/restore',
    domain: 'trash',
    action: 'trash.restore',
    severity: 'high',
    targetType: 'trash',
  },
  {
    method: 'POST',
    path: '/delete',
    domain: 'trash',
    action: 'trash.delete',
    severity: 'critical',
    targetType: 'trash',
  },
  {
    method: 'DELETE',
    path: '/empty',
    domain: 'trash',
    action: 'trash.empty',
    severity: 'critical',
    targetType: 'trash',
  },
]);

/**
 * GET /api/manage/trash - 获取回收站列表
 */
app.get('/', requirePermission('files:read'), withCache(15), async (c) => {
  const { env } = c;

  const fileRepo = new FileRepository(env.DB);
  const folderRepo = new FolderRepository(env.DB);

  const [files, folders] = await Promise.all([fileRepo.findTrash(), folderRepo.findTrash()]);

  // 格式化响应
  const formattedFiles = files.map((f) => ({
    ...f,
    type: 'file',
    url: getFileUrl(f.storage_key),
    originalName: f.original_name,
    deletedAt: f.deleted_at,
  }));

  const formattedFolders = folders.map((f) => ({
    ...f,
    type: 'folder',
    deletedAt: f.deleted_at,
  }));

  // 合并并按删除时间倒序排列
  const items = [...formattedFolders, ...formattedFiles].sort((a, b) => b.deletedAt - a.deletedAt);

  return c.json({
    success: true,
    data: items,
  });
});

/**
 * POST /api/manage/trash/restore - 还原项目
 */
app.post(
  '/restore',
  requirePermission('files:write'),
  zValidator('json', RestoreSchema),
  async (c) => {
    const { env } = c;
    const { fileIds, folderIds } = c.req.valid('json');

    const fileRepo = new FileRepository(env.DB);
    const folderRepo = new FolderRepository(env.DB);
    const [filesToRestore, foldersToRestore] = await Promise.all([
      fileIds.length > 0 ? fileRepo.findByIds(fileIds) : [],
      folderIds.length > 0 ? Promise.all(folderIds.map((id) => folderRepo.findById(id))) : [],
    ]);

    if (fileIds.length > 0) {
      await fileRepo.restoreBatch(fileIds);
    }

    if (folderIds.length > 0) {
      await Promise.all(folderIds.map((id) => folderRepo.restore(id)));
    }

    const outboxEvents = [
      ...filesToRestore.map((file) => ({
        event_type: 'v1_file_updated',
        aggregate_type: 'file',
        aggregate_id: file.id,
        payload: {
          file_id: file.id,
          folder_ids: [file.folder_id],
        },
      })),
      ...foldersToRestore.filter(Boolean).map((folder) => ({
        event_type: 'v1_folder_updated',
        aggregate_type: 'folder',
        aggregate_id: folder.id,
        payload: {
          folder_id: folder.id,
          parent_ids: [folder.parent_id, folder.id].filter((value) => value !== undefined),
        },
      })),
    ];
    await publishDomainEventsAndPoll(
      c,
      outboxEvents,
      `manage-trash-restore:${fileIds.length}:${folderIds.length}`
    );
    scheduleAuditEvent(c, {
      domain: 'trash',
      action: 'trash.restore',
      result: 'success',
      severity: 'high',
      targetType: 'trash',
      summary: `Restored ${fileIds.length + folderIds.length} trash items`,
      metadata: { fileCount: fileIds.length, folderCount: folderIds.length },
    });

    return c.json({ success: true, message: MSG.COMMON.RESTORE_SUCCESS || 'Restore successful' });
  }
);

/**
 * POST /api/manage/trash/delete - 彻底删除项目 (Permanent Delete)
 */
app.post(
  '/delete',
  requirePermission('files:delete'),
  zValidator('json', DeleteTrashSchema),
  async (c) => {
    const { env } = c;
    const { fileIds, folderIds } = c.req.valid('json');

    const fileRepo = new FileRepository(env.DB);
    const folderRepo = new FolderRepository(env.DB);

    // 1. 永久删除文件
    if (fileIds.length > 0) {
      // 获取 R2 存储键（分块查询，避免超出 D1 绑定参数上限）
      const results = [];
      for (const idChunk of chunkArray(fileIds, D1_MAX_IN_CLAUSE_SIZE)) {
        const placeholders = idChunk.map(() => '?').join(',');
        const { results: chunkResults } = await env.DB.prepare(
          `SELECT storage_key, content_hash FROM files WHERE id IN (${placeholders})`
        )
          .bind(...idChunk)
          .all();
        results.push(...chunkResults);
      }

      // 从 R2/CAS 删除；B-M6：R2 删除失败不再"警告后继续删 DB"——
      // 那会产生孤儿对象且文件台账消失，物理泄漏不可追溯
      await Promise.all(
        results.map(async (f) => {
          if (f.content_hash) {
            await decrementRefCount(env, f.content_hash);
          } else if (env.R2_BUCKET && f.storage_key) {
            try {
              await env.R2_BUCKET.delete(f.storage_key);
            } catch (err) {
              throw new Error(`R2 对象删除失败（${f.storage_key}）：${err?.message || err}`);
            }
          }
        })
      );

      // 清理镜像副本与记录（幂等：无镜像时为 no-op）
      await purgeStorageMirrors(env, fileIds);

      // 从数据库删除
      await fileRepo.deleteBatch(fileIds);
    }

    // 2. 永久删除文件夹
    if (folderIds.length > 0) {
      for (const folderId of folderIds) {
        const storageKeys = await folderRepo.getAllStorageKeysRecursive(folderId);
        if (env.R2_BUCKET && storageKeys.length > 0) {
          await Promise.all(
            storageKeys.map((key) =>
              env.R2_BUCKET.delete(key).catch((err) =>
                console.warn('[Trash] R2 delete failed:', err.message)
              )
            )
          );
        }
        // B-M6：文件夹内文件的镜像记录一并清理
        const { results: folderFileRows } = await env.DB.prepare(
          `SELECT id FROM files WHERE folder_id = ?`
        )
          .bind(folderId)
          .all();
        await purgeStorageMirrors(env, (folderFileRows || []).map((row) => row.id));
        await folderRepo.deleteRecursive(folderId);
      }
    }
    scheduleAuditEvent(c, {
      domain: 'trash',
      action: 'trash.delete',
      result: 'success',
      severity: 'critical',
      targetType: 'trash',
      summary: `Permanently deleted ${fileIds.length + folderIds.length} trash items`,
      metadata: { fileCount: fileIds.length, folderCount: folderIds.length },
    });

    return c.json({ success: true, message: MSG.COMMON.DELETE_SUCCESS });
  }
);

/**
 * DELETE /api/manage/trash/empty - 清空回收站
 */
app.delete('/empty', requirePermission('files:delete'), async (c) => {
  const { env } = c;

  const fileRepo = new FileRepository(env.DB);
  const folderRepo = new FolderRepository(env.DB);

  // 1. 获取所有回收站项目
  const [files, folders] = await Promise.all([fileRepo.findTrash(), folderRepo.findTrash()]);

  // 2. 删除文件 (R2 + DB)
  if (files.length > 0) {
    await Promise.all(
      files.map(async (f) => {
        if (f.content_hash) {
          await decrementRefCount(env, f.content_hash);
        } else if (env.R2_BUCKET && f.storage_key) {
          try {
            await env.R2_BUCKET.delete(f.storage_key);
          } catch (err) {
            throw new Error(`R2 对象删除失败（${f.storage_key}）：${err?.message || err}`);
          }
        }
      })
    );
    const fileIds = files.map((f) => f.id);
    await purgeStorageMirrors(env, fileIds);
    await fileRepo.deleteBatch(fileIds);
  }

  // 3. 递归删除文件夹及其内容
  if (folders.length > 0) {
    for (const folder of folders) {
      // 检查是否还存在（可能已被父文件夹的 deleteRecursive 删除）
      const exists = await folderRepo.findById(folder.id);
      if (!exists) continue;

      const storageKeys = await folderRepo.getAllStorageKeysRecursive(folder.id);
      if (env.R2_BUCKET && storageKeys.length > 0) {
        await Promise.all(
          storageKeys.map((key) =>
            env.R2_BUCKET.delete(key).catch((err) =>
              console.warn('[Trash] R2 delete failed:', err.message)
            )
          )
        );
      }
      await folderRepo.deleteRecursive(folder.id);
    }
  }
  scheduleAuditEvent(c, {
    domain: 'trash',
    action: 'trash.empty',
    result: 'success',
    severity: 'critical',
    targetType: 'trash',
    summary: 'Emptied trash',
    metadata: { fileCount: files.length, folderCount: folders.length },
  });

  return c.json({ success: true, message: MSG.COMMON.DELETE_SUCCESS });
});

export default app;
