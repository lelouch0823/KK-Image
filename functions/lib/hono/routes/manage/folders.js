import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { withCache } from '../../middleware/cache.js';
import { generateId, generateShareToken, now, timestampToIso } from '../../../../api/utils/id.js';
import { getShareUrl, getFileUrl } from '../../../../api/utils/url.js';
import { MSG } from '../../../../api/utils/messages.js';

const app = new Hono();

// Schemas
const CreateFolderSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().default(''),
    parentId: z.string().optional().nullable(),
    isPublic: z.boolean().optional().default(false),
    password: z.string().min(4).max(50).optional().nullable()
});

const UpdateFolderSchema = CreateFolderSchema.partial().extend({
    shareExpiresAt: z.number().optional().nullable()
});

/**
 * GET /api/manage/folders - 获取文件夹列表
 */
app.get('/', async (c) => {
    const { env } = c;
    const url = new URL(c.req.url);
    const parentId = url.searchParams.get('parent_id') || null;
    const all = url.searchParams.get('all') === 'true';

    try {
        let query;
        if (all) {
            query = env.DB.prepare(`
        SELECT f.id, f.parent_id, f.name
        FROM folders f WHERE f.id != 'root'
        ORDER BY f.name ASC
      `);
        } else if (parentId) {
            query = env.DB.prepare(`
        SELECT f.*, 
          (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
          (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
        FROM folders f WHERE f.parent_id = ? ORDER BY f.name ASC
      `).bind(parentId);
        } else {
            query = env.DB.prepare(`
        SELECT f.*, 
          (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
          (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
        FROM folders f WHERE f.parent_id IS NULL AND f.id != 'root'
        ORDER BY f.name ASC
      `);
        }

        const { results } = await query.all();

        return c.json({
            success: true,
            data: results.map(folder => ({
                ...folder,
                isPublic: Boolean(folder.is_public),
                createdAt: folder.created_at,
                updatedAt: folder.updated_at,
                subfolderCount: folder.subfolder_count,
                fileCount: folder.file_count
            }))
        });
    } catch (err) {
        console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

/**
 * GET /api/manage/folders/:id - 获取文件夹详情
 */
app.get('/:id', withCache(30), async (c) => {
    const { env } = c;
    const folderId = c.req.param('id');

    try {
        const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(folderId).first();
        if (!folder) {
            return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
        }

        // 并行获取子文件夹和文件
        const [subfoldersResult, filesResult] = await Promise.all([
            env.DB.prepare(`
        SELECT f.*, 
          (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
          (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
        FROM folders f WHERE f.parent_id = ? ORDER BY f.name ASC
      `).bind(folderId).all(),
            env.DB.prepare('SELECT * FROM files WHERE folder_id = ? ORDER BY created_at DESC').bind(folderId).all()
        ]);

        // 获取面包屑
        const breadcrumbs = await getBreadcrumbs(env.DB, folderId);

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
                subfolders: subfoldersResult.results.map(f => ({
                    id: f.id,
                    name: f.name,
                    subfolderCount: f.subfolder_count,
                    fileCount: f.file_count,
                    isPublic: Boolean(f.is_public),
                    createdAt: f.created_at
                })),
                files: filesResult.results.map(f => ({
                    id: f.id,
                    name: f.name,
                    originalName: f.original_name,
                    size: f.size,
                    mimeType: f.mime_type,
                    url: getFileUrl(f.storage_key),
                    createdAt: f.created_at
                }))
            }
        });
    } catch (err) {
        console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

/**
 * POST /api/manage/folders - 创建文件夹
 */
app.post('/',
    requirePermission('folders:write'),
    zValidator('json', CreateFolderSchema),
    async (c) => {
        const { env } = c;
        const { name, description, parentId, isPublic, password } = c.req.valid('json');

        try {
            if (parentId) {
                const parent = await env.DB.prepare('SELECT id FROM folders WHERE id = ?').bind(parentId).first();
                if (!parent) {
                    return c.json({ success: false, error: MSG.FOLDER.PARENT_NOT_FOUND }, 400);
                }
            }

            const folderId = generateId();
            const shareToken = isPublic ? generateShareToken() : null;
            const nowMs = Date.now();

            await env.DB.prepare(`
        INSERT INTO folders (id, parent_id, name, description, share_token, is_public, password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(folderId, parentId || null, name.trim(), description.trim(), shareToken, isPublic ? 1 : 0, password || null, nowMs, nowMs).run();

            return c.json({
                success: true,
                data: {
                    id: folderId,
                    name: name.trim(),
                    description: description.trim(),
                    parentId,
                    shareToken,
                    isPublic,
                    shareUrl: getShareUrl(shareToken),
                    createdAt: nowMs
                }
            }, 201);
        } catch (err) {
            console.error(`${MSG.COMMON.CREATE_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.CREATE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * PUT /api/manage/folders/:id - 更新文件夹
 */
app.put('/:id',
    requirePermission('folders:write'),
    zValidator('json', UpdateFolderSchema),
    async (c) => {
        const { env } = c;
        const folderId = c.req.param('id');
        const data = c.req.valid('json');

        try {
            const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(folderId).first();
            if (!folder) {
                return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
            }

            const updates = [];
            const values = [];

            if (data.name !== undefined) {
                updates.push('name = ?');
                values.push(data.name.trim());
            }
            if (data.description !== undefined) {
                updates.push('description = ?');
                values.push(data.description.trim());
            }
            if (data.isPublic !== undefined) {
                updates.push('is_public = ?');
                values.push(data.isPublic ? 1 : 0);
            }
            if (data.password !== undefined) {
                updates.push('password = ?');
                values.push(data.password || null);
            }
            if (data.parentId !== undefined) {
                if (data.parentId === folderId) {
                    return c.json({ success: false, error: MSG.FOLDER.MOVE_TO_SELF }, 400);
                }
                updates.push('parent_id = ?');
                values.push(data.parentId);
            }
            if (data.shareExpiresAt !== undefined) {
                updates.push('share_expires_at = ?');
                values.push(data.shareExpiresAt);
            }

            // 自动生成分享令牌
            if ((data.isPublic === true || data.shareExpiresAt !== undefined) && !folder.share_token) {
                updates.push('share_token = ?');
                values.push(generateShareToken());
            }

            updates.push('updated_at = ?');
            values.push(Date.now());
            values.push(folderId);

            await env.DB.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

            const updated = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(folderId).first();

            return c.json({
                success: true,
                data: {
                    ...updated,
                    isPublic: Boolean(updated.is_public),
                    shareUrl: getShareUrl(updated.share_token)
                }
            });
        } catch (err) {
            console.error(`${MSG.COMMON.UPDATE_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.UPDATE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * DELETE /api/manage/folders/:id - 删除文件夹
 */
app.delete('/:id',
    requirePermission('folders:delete'),
    async (c) => {
        const { env } = c;
        const folderId = c.req.param('id');

        try {
            if (folderId === 'root') {
                return c.json({ success: false, error: MSG.FOLDER.ROOT_CANNOT_DELETE }, 400);
            }

            const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(folderId).first();
            if (!folder) {
                return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
            }

            // 获取所有子文件的存储键
            const { results: files } = await env.DB.prepare(`
        WITH RECURSIVE subfolder_tree AS (
          SELECT id FROM folders WHERE id = ?
          UNION ALL
          SELECT f.id FROM folders f JOIN subfolder_tree st ON f.parent_id = st.id
        )
        SELECT storage_key FROM files WHERE folder_id IN (SELECT id FROM subfolder_tree)
      `).bind(folderId).all();

            // 从 R2 删除文件
            if (env.R2_BUCKET && files.length > 0) {
                await Promise.all(files.map(f => env.R2_BUCKET.delete(f.storage_key).catch(() => { })));
            }

            // 删除文件夹（级联删除）
            await env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(folderId).run();

            return c.json({ success: true, message: MSG.FOLDER.DELETE_SUCCESS });
        } catch (err) {
            console.error(`${MSG.COMMON.DELETE_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.DELETE_FAILED}: ${err.message}` }, 500);
        }
    }
);

// 面包屑辅助函数
async function getBreadcrumbs(db, folderId) {
    const breadcrumbs = [];
    let currentId = folderId;

    while (currentId) {
        const folder = await db.prepare('SELECT id, name, parent_id FROM folders WHERE id = ?').bind(currentId).first();
        if (!folder || folder.id === 'root') break;
        breadcrumbs.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parent_id;
    }

    return breadcrumbs;
}

import { RedundancyManager } from '../../../../storage/redundancy.js';
import { triggerWebhook } from '../../../../api/utils/webhook.js';

/**
 * POST /api/manage/folders/:id/upload - 上传文件到文件夹
 */
app.post('/:id/upload',
    requirePermission('files:write'),
    async (c) => {
        const folderId = c.req.param('id');
        const { env } = c;
        const user = c.get('user');

        try {
            // 1. 验证文件夹是否存在
            const folder = await env.DB.prepare('SELECT id FROM folders WHERE id = ?').bind(folderId).first();
            if (!folder) {
                return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
            }

            // 2. 获取上传文件
            const formData = await c.req.parseBody();
            const uploadFile = formData['file']; // Hono uses ['file'] for file input

            if (!uploadFile || !(uploadFile instanceof File)) {
                return c.json({ success: false, error: MSG.COMMON.UPLOAD_NO_FILE }, 400);
            }

            const fileName = uploadFile.name;
            const fileSize = uploadFile.size;
            const fileType = uploadFile.type;

            // 3. 使用 RedundancyManager 处理存储
            // 构建 context 模拟对象，适配 RedundancyManager
            const mockContext = {
                request: c.req.raw,
                env: env,
                waitUntil: (promise) => c.executionCtx.waitUntil(promise)
            };

            const redundancyManager = new RedundancyManager(env, mockContext);
            const result = await redundancyManager.upload(uploadFile, {
                fileName: fileName,
                contentType: fileType
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            const fileId = result.fileId;
            const nowMs = Date.now();

            // 4. 保存数据库记录
            await env.DB.prepare(`
                INSERT INTO files (id, folder_id, name, original_name, size, mime_type, storage_key, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                fileId,
                folderId,
                fileName,
                fileName,
                fileSize,
                fileType,
                fileId, // storage_key
                user.id,
                nowMs,
                nowMs
            ).run();

            // 5. 触发 Webhook
            const fileInfo = {
                id: fileId,
                filename: fileName,
                size: fileSize,
                type: fileType,
                uploadTime: timestampToIso(nowMs),
                url: getFileUrl(fileId),
                uploader: user.name || user.username || user.id,
                storage: result.metadata?.storage
            };

            c.executionCtx.waitUntil((async () => {
                try {
                    await triggerWebhook(env, 'file.uploaded', {
                        file: fileInfo,
                        user: user
                    });
                } catch (e) {
                    console.error('Webhook trigger failed:', e);
                }
            })());

            return c.json({
                success: true,
                data: {
                    id: fileId,
                    name: fileName,
                    url: `/file/${fileId}`,
                    src: `/file/${fileId}` // 兼容旧前端
                }
            });

        } catch (err) {
            console.error('Upload failed:', err);
            return c.json({ success: false, error: `${MSG.COMMON.UPLOAD_FAILED}: ${err.message}` }, 500);
        }
    }
);


export default app;
