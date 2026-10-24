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
import { scheduleCacheInvalidation } from '../../_shared/route-helpers.js';
import { getManageTrashCacheUrls } from '../_shared/cache-urls.js';
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

/**
 * B13：按块"先删台账行、后清对象"地永久删除回收站文件。
 *
 * 行删除是每个文件的认领：重试时查询/列表不再返回已删除的行，天然幂等。
 * 对象清理（blob 引用扣减 / 直连 R2 删除）放在行删除之后——清理失败只会
 * 留下保守方向的引用泄漏（对象多留、可对账），不会出现旧实现
 * "对象已删、台账仍在"的重试双重扣减（共享 blob 的其它文件被连坐删除）
 * 或"台账已删、对象泄漏且不可追溯"的静默丢失。
 */
async function permanentlyDeleteTrashedFiles(env, fileRepo, files) {
  for (const fileChunk of chunkArray(files, 20)) {
    await fileRepo.deleteBatch(fileChunk.map((f) => f.id));
    await purgeStorageMirrors(env, fileChunk.map((f) => f.id));
    for (const f of fileChunk) {
      if (f.content_hash) {
        await decrementRefCount(env, f.content_hash);
      } else if (env.R2_BUCKET && f.storage_key) {
        try {
          await env.R2_BUCKET.delete(f.storage_key);
        } catch (err) {
          throw new Error(`R2 对象删除失败（${f.storage_key}）：${err?.message || err}`);
        }
      }
    }
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
    const [filesFetched, foldersFetched] = await Promise.all([
      fileIds.length > 0 ? fileRepo.findByIds(fileIds) : [],
      folderIds.length > 0 ? Promise.all(folderIds.map((id) => folderRepo.findById(id))) : [],
    ]);

    // B5：只还原确实在回收站内的条目。活跃条目混入时静默跳过——
    // restoreBatch 对未删除行虽是无害 no-op，但 outbox 事件与审计计数
    // 必须与实际还原的条目一致，且防止把"还原"当作探测/扰动活跃数据的入口
    const filesToRestore = (filesFetched || []).filter(
      (file) => file?.deleted_at !== null && file?.deleted_at !== undefined
    );
    const foldersToRestore = (foldersFetched || []).filter(
      (folder) => folder && folder.deleted_at !== null && folder.deleted_at !== undefined
    );

    if (filesToRestore.length > 0) {
      await fileRepo.restoreBatch(filesToRestore.map((file) => file.id));
    }

    if (foldersToRestore.length > 0) {
      await Promise.all(foldersToRestore.map((folder) => folderRepo.restore(folder.id)));
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
      ...foldersToRestore.map((folder) => ({
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
      `manage-trash-restore:${filesToRestore.length}:${foldersToRestore.length}`
    );
    // 还原/彻底删除都会改变回收站列表内容，失效 trash scope 缓存
    //（restore 对文件/文件夹主列表的失效由 outbox 的 cache consumer 负责）
    scheduleCacheInvalidation(c, getManageTrashCacheUrls(c));
    scheduleAuditEvent(c, {
      domain: 'trash',
      action: 'trash.restore',
      result: 'success',
      severity: 'high',
      targetType: 'trash',
      summary: `Restored ${filesToRestore.length + foldersToRestore.length} trash items`,
      metadata: { fileCount: filesToRestore.length, folderCount: foldersToRestore.length },
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
      // B5：只删除确实在回收站内的文件（deleted_at IS NOT NULL）。无此过滤时
      // 传入活跃文件 id 可绕过"先进回收站、冷静期"生命周期直接物理删除线上文件
      const trashedFiles = [];
      for (const idChunk of chunkArray(fileIds, D1_MAX_IN_CLAUSE_SIZE)) {
        const placeholders = idChunk.map(() => '?').join(',');
        const { results: chunkResults } = await env.DB.prepare(
          `SELECT id, storage_key, content_hash FROM files WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`
        )
          .bind(...idChunk)
          .all();
        trashedFiles.push(...chunkResults);
      }

      // B13：分块"先删台账行、后清对象"（见 permanentlyDeleteTrashedFiles），
      // 重试天然从剩余行续跑，不会对已处理文件重复扣减 blob 引用
      await permanentlyDeleteTrashedFiles(env, fileRepo, trashedFiles);
    }

    // 2. 永久删除文件夹（仅回收站内的文件夹，B5）
    if (folderIds.length > 0) {
      for (const folderId of folderIds) {
        const folder = await folderRepo.findById(folderId);
        if (!folder || folder.deleted_at === null || folder.deleted_at === undefined) continue;

        const storageKeys = await folderRepo.getAllStorageKeysRecursive(folderId);
        if (env.R2_BUCKET && storageKeys.length > 0) {
          // B-M6：与文件分支对齐——R2 删除失败必须中止 DB 删除，
          // 否则 deleteRecursive 清掉台账后失败对象成永久孤儿
          await Promise.all(
            storageKeys.map(async (key) => {
              try {
                await env.R2_BUCKET.delete(key);
              } catch (err) {
                throw new Error(`R2 对象删除失败（${key}）：${err?.message || err}`);
              }
            })
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
    // 彻底删除清空了回收站条目，失效 trash scope 缓存
    scheduleCacheInvalidation(c, getManageTrashCacheUrls(c));
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

  // 2. 删除文件 (R2 + DB)：findTrash 只返回回收站内条目（B5 语义），
  // 删除模式与 /delete 一致（B13：先删台账行、后清对象、分块可重试）
  if (files.length > 0) {
    await permanentlyDeleteTrashedFiles(env, fileRepo, files);
  }

  // 3. 递归删除文件夹及其内容
  if (folders.length > 0) {
    for (const folder of folders) {
      // 检查是否还存在（可能已被父文件夹的 deleteRecursive 删除）
      const exists = await folderRepo.findById(folder.id);
      if (!exists) continue;

      const storageKeys = await folderRepo.getAllStorageKeysRecursive(folder.id);
      if (env.R2_BUCKET && storageKeys.length > 0) {
        // B-M6：与文件分支对齐——R2 删除失败必须中止 DB 删除，
        // 否则 deleteRecursive 清掉台账后失败对象成永久孤儿
        await Promise.all(
          storageKeys.map(async (key) => {
            try {
              await env.R2_BUCKET.delete(key);
            } catch (err) {
              throw new Error(`R2 对象删除失败（${key}）：${err?.message || err}`);
            }
          })
        );
      }
      await folderRepo.deleteRecursive(folder.id);
    }
  }
  // 清空回收站后失效 trash scope 缓存
  scheduleCacheInvalidation(c, getManageTrashCacheUrls(c));
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
