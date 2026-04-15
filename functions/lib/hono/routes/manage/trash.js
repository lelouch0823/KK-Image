import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { getFileUrl, MSG } from '../../../../_shared/utils.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { decrementRefCount } from '../../../../api/utils/blob-utils.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../_shared/audit-route-contract.js';
import { publishDomainEventsAndPoll } from '../../_shared/domain-outbox.js';

const app = new Hono();
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/restore', domain: 'trash', action: 'trash.restore', severity: 'high', targetType: 'trash' },
    { method: 'POST', path: '/delete', domain: 'trash', action: 'trash.delete', severity: 'critical', targetType: 'trash' },
    { method: 'DELETE', path: '/empty', domain: 'trash', action: 'trash.empty', severity: 'critical', targetType: 'trash' },
]);

// Schemas
const RestoreSchema = z.object({
    fileIds: z.array(z.string()).optional().default([]),
    folderIds: z.array(z.string()).optional().default([]),
});

const DeleteTrashSchema = z.object({
    fileIds: z.array(z.string()).optional().default([]),
    folderIds: z.array(z.string()).optional().default([]),
});

/**
 * GET /api/manage/trash - 获取回收站列表
 */
app.get('/', requirePermission('files:read'), async (c) => {
    const { env } = c;

    const fileRepo = new FileRepository(env.DB);
    const folderRepo = new FolderRepository(env.DB);

    const [files, folders] = await Promise.all([
        fileRepo.findTrash(),
        folderRepo.findTrash()
    ]);

    // 格式化响应
    const formattedFiles = files.map(f => ({
        ...f,
        type: 'file',
        url: getFileUrl(f.storage_key),
        originalName: f.original_name,
        deletedAt: f.deleted_at
    }));

    const formattedFolders = folders.map(f => ({
        ...f,
        type: 'folder',
        deletedAt: f.deleted_at
    }));

    // 合并并按删除时间倒序排列
    const items = [...formattedFolders, ...formattedFiles].sort((a, b) => b.deletedAt - a.deletedAt);

    return c.json({
        success: true,
        data: items
    });
});

/**
 * POST /api/manage/trash/restore - 还原项目
 */
app.post('/restore', requirePermission('files:write'), zValidator('json', RestoreSchema), async (c) => {
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
        await Promise.all(folderIds.map(id => folderRepo.restore(id)));
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
        ...foldersToRestore
            .filter(Boolean)
            .map((folder) => ({
                event_type: 'v1_folder_updated',
                aggregate_type: 'folder',
                aggregate_id: folder.id,
                payload: {
                    folder_id: folder.id,
                    parent_ids: [folder.parent_id, folder.id].filter((value) => value !== undefined),
                },
            })),
    ];
    await publishDomainEventsAndPoll(c, outboxEvents, `manage-trash-restore:${fileIds.length}:${folderIds.length}`);
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
});

/**
 * POST /api/manage/trash/delete - 彻底删除项目 (Permanent Delete)
 */
app.post('/delete', requirePermission('files:delete'), zValidator('json', DeleteTrashSchema), async (c) => {
    const { env } = c;
    const { fileIds, folderIds } = c.req.valid('json');

    const fileRepo = new FileRepository(env.DB);
    const folderRepo = new FolderRepository(env.DB);

    // 1. 永久删除文件
    if (fileIds.length > 0) {
        // 获取 R2 存储键
        const placeholders = fileIds.map(() => '?').join(',');
        const { results } = await env.DB.prepare(
            `SELECT storage_key, content_hash FROM files WHERE id IN (${placeholders})`
        ).bind(...fileIds).all();

        // 从 R2/CAS 删除
        await Promise.all(results.map(async (f) => {
            if (f.content_hash) {
                await decrementRefCount(env, f.content_hash);
            } else if (env.R2_BUCKET && f.storage_key) {
                await env.R2_BUCKET.delete(f.storage_key).catch(() => { });
            }
        }));

        // 从数据库删除
        await fileRepo.deleteBatch(fileIds);
    }

    // 2. 永久删除文件夹
    if (folderIds.length > 0) {
        for (const folderId of folderIds) {
            const storageKeys = await folderRepo.getAllStorageKeysRecursive(folderId);
            if (env.R2_BUCKET && storageKeys.length > 0) {
                await Promise.all(storageKeys.map(key => env.R2_BUCKET.delete(key).catch(() => { })));
            }
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
});

/**
 * DELETE /api/manage/trash/empty - 清空回收站
 */
app.delete('/empty', requirePermission('files:delete'), async (c) => {
    const { env } = c;

    const fileRepo = new FileRepository(env.DB);
    const folderRepo = new FolderRepository(env.DB);

    // 1. 获取所有回收站项目
    const [files, folders] = await Promise.all([
        fileRepo.findTrash(),
        folderRepo.findTrash()
    ]);

    // 2. 删除文件 (R2 + DB)
    if (files.length > 0) {
        await Promise.all(files.map(async (f) => {
            if (f.content_hash) {
                await decrementRefCount(env, f.content_hash);
            } else if (env.R2_BUCKET && f.storage_key) {
                await env.R2_BUCKET.delete(f.storage_key).catch(() => { });
            }
        }));
        const fileIds = files.map(f => f.id);
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
                await Promise.all(storageKeys.map(key => env.R2_BUCKET.delete(key).catch(() => { })));
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
