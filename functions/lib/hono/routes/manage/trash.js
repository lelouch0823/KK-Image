import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { getFileUrl, MSG } from '../../_shared/utils.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { decrementRefCount } from '../../../../api/utils/blob-utils.js';

const app = new Hono();

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

    try {
        const fileRepo = new FileRepository(env.DB);
        const folderRepo = new FolderRepository(env.DB);

        const [files, folders] = await Promise.all([
            fileRepo.findTrash(),
            folderRepo.findTrash()
        ]);

        // Format response
        const formattedFiles = files.map(f => ({
            ...f,
            type: 'file',
            url: getFileUrl(f.storage_key),
            originalName: f.original_name, // Ensure camelCase for frontend
            deletedAt: f.deleted_at
        }));

        const formattedFolders = folders.map(f => ({
            ...f,
            type: 'folder',
            deletedAt: f.deleted_at
        }));

        // Combine and sort by deletedAt desc
        const items = [...formattedFolders, ...formattedFiles].sort((a, b) => b.deletedAt - a.deletedAt);

        return c.json({
            success: true,
            data: items
        });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * POST /api/manage/trash/restore - 还原项目
 */
app.post('/restore', requirePermission('files:write'), zValidator('json', RestoreSchema), async (c) => {
    const { env } = c;
    const { fileIds, folderIds } = c.req.valid('json');

    try {
        const fileRepo = new FileRepository(env.DB);
        const folderRepo = new FolderRepository(env.DB);

        if (fileIds.length > 0) {
            await fileRepo.restoreBatch(fileIds);
        }

        if (folderIds.length > 0) {
            // FolderRepo doesn't have batch restore yet, loop for now or add it.
            // Looping is acceptable for reasonable numbers.
            await Promise.all(folderIds.map(id => folderRepo.restore(id)));
        }

        return c.json({ success: true, message: MSG.COMMON.RESTORE_SUCCESS || 'Restore successful' });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * POST /api/manage/trash/delete - 彻底删除项目 (Permanent Delete)
 */
app.post('/delete', requirePermission('files:delete'), zValidator('json', DeleteTrashSchema), async (c) => {
    const { env } = c;
    const { fileIds, folderIds } = c.req.valid('json');

    try {
        const fileRepo = new FileRepository(env.DB);
        const folderRepo = new FolderRepository(env.DB);

        // 1. Permanently delete files
        if (fileIds.length > 0) {
            // Get storage keys for R2 deletion
            const placeholders = fileIds.map(() => '?').join(',');
            const { results } = await env.DB.prepare(
                `SELECT storage_key, content_hash FROM files WHERE id IN (${placeholders})`
            ).bind(...fileIds).all();

            // Delete from R2/CAS
            await Promise.all(results.map(async (f) => {
                if (f.content_hash) {
                    await decrementRefCount(env, f.content_hash);
                } else if (env.R2_BUCKET && f.storage_key) {
                    await env.R2_BUCKET.delete(f.storage_key).catch(() => { });
                }
            }));

            // Delete from DB
            await fileRepo.deleteBatch(fileIds);
        }

        // 2. Permanently delete folders
        if (folderIds.length > 0) {
            // For each folder, we need to delete recursively (files in it + subfolders)
            // `deleteRecursive` handles DB + we need to handle R2?
            // `FolderRepository.deleteRecursive` DOES NOT handle R2, it only does DB DELETE.
            // We need to fetch all storage keys inside these folders first!

            // This can be expensive if folders are large.
            // Loop through folders
            for (const folderId of folderIds) {
                const storageKeys = await folderRepo.getAllStorageKeysRecursive(folderId);
                if (env.R2_BUCKET && storageKeys.length > 0) {
                    // Batch delete from R2? R2 delete is per object.
                    // Promise.all limit?
                    // Use a chunked approach if too many.
                    await Promise.all(storageKeys.map(key => env.R2_BUCKET.delete(key).catch(() => { })));
                }
                await folderRepo.deleteRecursive(folderId);
            }
        }

        return c.json({ success: true, message: MSG.COMMON.DELETE_SUCCESS });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * DELETE /api/manage/trash/empty - 清空回收站
 */
app.delete('/empty', requirePermission('files:delete'), async (c) => {
    const { env } = c;

    try {
        const fileRepo = new FileRepository(env.DB);
        const folderRepo = new FolderRepository(env.DB);

        // 1. Get ALL trash items
        const [files, folders] = await Promise.all([
            fileRepo.findTrash(),
            folderRepo.findTrash()
        ]);

        // 2. Delete files matching trash (R2 + DB)
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

        // 3. Delete folders matching trash (Recursive logic? or just those marked as deleted?)
        // If a folder is 'deleted', we must physically delete it and its contents.
        // `deleteRecursive` will handle the tree.
        // We should process top-level deleted folders first?
        // Actually, if we just loop through all deleted folders and call deleteRecursive...
        // Some might be children of others.
        // If we delete parent, children are gone from DB. calling deleteRecursive on child later counts as no-op?
        // Safe to call.
        if (folders.length > 0) {
            for (const folder of folders) {
                // Check if it still exists (might have been deleted by parent's deleteRecursive)
                const exists = await folderRepo.findById(folder.id);
                if (!exists) continue;

                const storageKeys = await folderRepo.getAllStorageKeysRecursive(folder.id);
                if (env.R2_BUCKET && storageKeys.length > 0) {
                    await Promise.all(storageKeys.map(key => env.R2_BUCKET.delete(key).catch(() => { })));
                }
                await folderRepo.deleteRecursive(folder.id);
            }
        }

        return c.json({ success: true, message: MSG.COMMON.DELETE_SUCCESS });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default app;
