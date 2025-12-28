import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { getFileUrl } from '../../../../api/utils/url.js';
import { batchDelete } from '../../../../lib/db/batch.js';

const app = new Hono();

// Schemas
const DeleteFilesSchema = z.object({
    ids: z.array(z.string()).min(1).max(100)
});

const MoveFilesSchema = z.object({
    ids: z.array(z.string()).min(1).max(100),
    targetFolderId: z.string().nullable()
});

const RenameFileSchema = z.object({
    name: z.string().min(1).max(255)
});

/**
 * GET /api/manage/files - 获取文件列表（支持根目录和文件夹）
 */
app.get('/', async (c) => {
    const { env } = c;
    const url = new URL(c.req.url);
    const folderId = url.searchParams.get('folder_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    try {
        let sql = 'SELECT * FROM files';
        const bindings = [];

        if (folderId) {
            sql += ' WHERE folder_id = ?';
            bindings.push(folderId);
        } else {
            sql += ' WHERE folder_id IS NULL';
        }

        // 获取总数
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const countResult = await env.DB.prepare(countSql).bind(...bindings).first();
        const total = countResult?.total || 0;

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        bindings.push(limit, (page - 1) * limit);

        const { results } = await env.DB.prepare(sql).bind(...bindings).all();

        return c.json({
            success: true,
            data: results.map(f => ({
                id: f.id,
                name: f.name,
                originalName: f.original_name,
                size: f.size,
                mimeType: f.mime_type,
                url: getFileUrl(f.storage_key),
                folderId: f.folder_id,
                createdAt: f.created_at
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        console.error('获取文件列表失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * GET /api/manage/files/:id - 获取单个文件详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const fileId = c.req.param('id');

    try {
        const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first();

        if (!file) {
            return c.json({ success: false, error: '文件不存在' }, 404);
        }

        return c.json({
            success: true,
            data: {
                id: file.id,
                name: file.name,
                originalName: file.original_name,
                size: file.size,
                mimeType: file.mime_type,
                url: getFileUrl(file.storage_key),
                folderId: file.folder_id,
                storageKey: file.storage_key,
                createdAt: file.created_at,
                updatedAt: file.updated_at
            }
        });
    } catch (err) {
        console.error('获取文件详情失败:', err);
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * PUT /api/manage/files/:id - 更新文件（重命名）
 */
app.put('/:id',
    requirePermission('files:write'),
    zValidator('json', RenameFileSchema),
    async (c) => {
        const { env } = c;
        const fileId = c.req.param('id');
        const { name } = c.req.valid('json');

        try {
            const file = await env.DB.prepare('SELECT id FROM files WHERE id = ?').bind(fileId).first();
            if (!file) {
                return c.json({ success: false, error: '文件不存在' }, 404);
            }

            await env.DB.prepare(
                'UPDATE files SET name = ?, updated_at = ? WHERE id = ?'
            ).bind(name, Date.now(), fileId).run();

            return c.json({ success: true, message: '文件已重命名' });
        } catch (err) {
            console.error('重命名文件失败:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

/**
 * DELETE /api/manage/files/:id - 删除单个文件
 */
app.delete('/:id',
    requirePermission('files:delete'),
    async (c) => {
        const { env } = c;
        const fileId = c.req.param('id');

        try {
            const file = await env.DB.prepare('SELECT storage_key FROM files WHERE id = ?').bind(fileId).first();
            if (!file) {
                return c.json({ success: false, error: '文件不存在' }, 404);
            }

            // 从 R2 删除
            if (env.R2_BUCKET && file.storage_key) {
                await env.R2_BUCKET.delete(file.storage_key).catch(() => { });
            }

            await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run();

            return c.json({ success: true, message: '文件已删除' });
        } catch (err) {
            console.error('删除文件失败:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

/**
 * POST /api/manage/files/batch/delete - 批量删除文件
 */
app.post('/batch/delete',
    requirePermission('files:delete'),
    zValidator('json', DeleteFilesSchema),
    async (c) => {
        const { env } = c;
        const { ids } = c.req.valid('json');

        try {
            // 获取存储键
            const placeholders = ids.map(() => '?').join(',');
            const { results } = await env.DB.prepare(
                `SELECT id, storage_key FROM files WHERE id IN (${placeholders})`
            ).bind(...ids).all();

            // 从 R2 删除
            if (env.R2_BUCKET) {
                const keys = results.map(f => f.storage_key).filter(Boolean);
                await Promise.all(keys.map(key => env.R2_BUCKET.delete(key).catch(() => { })));
            }

            // 批量删除数据库记录
            await batchDelete(env.DB, 'files', ids);

            return c.json({
                success: true,
                message: `已删除 ${results.length} 个文件`
            });
        } catch (err) {
            console.error('批量删除文件失败:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

/**
 * POST /api/manage/files/batch/move - 批量移动文件
 */
app.post('/batch/move',
    requirePermission('files:write'),
    zValidator('json', MoveFilesSchema),
    async (c) => {
        const { env } = c;
        const { ids, targetFolderId } = c.req.valid('json');

        try {
            // 验证目标文件夹存在
            if (targetFolderId) {
                const folder = await env.DB.prepare('SELECT id FROM folders WHERE id = ?').bind(targetFolderId).first();
                if (!folder) {
                    return c.json({ success: false, error: '目标文件夹不存在' }, 404);
                }
            }

            const placeholders = ids.map(() => '?').join(',');
            await env.DB.prepare(
                `UPDATE files SET folder_id = ?, updated_at = ? WHERE id IN (${placeholders})`
            ).bind(targetFolderId, Date.now(), ...ids).run();

            return c.json({
                success: true,
                message: `已移动 ${ids.length} 个文件`
            });
        } catch (err) {
            console.error('批量移动文件失败:', err);
            return c.json({ success: false, error: err.message }, 500);
        }
    }
);

export default app;
