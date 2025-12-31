import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { FileQuerySchema, CreateFileSchema, BatchFileSchema, MoveFileSchema } from '../../schemas/file.js';
import { requirePermission } from '../../middleware/auth.js';
import { withCache, invalidateCache } from '../../middleware/cache.js';
import { batchDelete } from '../../../../lib/db/batch.js';
import { getFileUrl, generateId, now, MSG } from '../../_shared/utils.js';
import { decrementRefCount } from '../../../../api/utils/blob-utils.js';

const app = new Hono();

/**
 * GET /api/v1/files - 获取文件列表
 */
app.get('/',
    zValidator('query', FileQuerySchema),
    withCache(30),
    async (c) => {
        const { page, limit, sort, order, folderId, search, type, isPublic } = c.req.valid('query');
        const { env } = c;

        let sql = 'SELECT * FROM files WHERE 1=1';
        const bindings = [];

        if (folderId) {
            sql += ' AND folder_id = ?';
            bindings.push(folderId);
        }

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

        // 获取总数
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const countResult = await env.DB.prepare(countSql).bind(...bindings).first();
        const total = countResult?.total || 0;

        // 分页查询
        sql += ` ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`;
        bindings.push(limit, (page - 1) * limit);

        const { results } = await env.DB.prepare(sql).bind(...bindings).all();

        // 添加 URL
        const filesWithUrls = results.map(file => ({
            ...file,
            url: getFileUrl(file.storage_key)
        }));

        return c.json({
            success: true,
            data: filesWithUrls,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
);

/**
 * GET /api/v1/files/:id - 获取单个文件
 */
app.get('/:id', withCache(60), async (c) => {
    const id = c.req.param('id');
    const { env } = c;

    const file = await env.DB.prepare(
        'SELECT * FROM files WHERE id = ?'
    ).bind(id).first();

    if (!file) {
        return c.json({ success: false, error: MSG.FILE.NOT_FOUND }, 404);
    }

    return c.json({
        success: true,
        data: {
            ...file,
            url: getFileUrl(file.storage_key)
        }
    });
});

/**
 * POST /api/v1/files - 创建文件记录
 */
app.post('/',
    requirePermission('files:write'),
    zValidator('json', CreateFileSchema),
    async (c) => {
        const data = c.req.valid('json');
        const user = c.get('user');
        const { env } = c;

        const id = generateId();
        const nowMs = Date.now();

        await env.DB.prepare(`
      INSERT INTO files (id, name, folder_id, is_public, storage_key, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, data.name, data.folderId || null, data.isPublic ? 1 : 0, id, user.id, nowMs, nowMs).run();

        return c.json({
            success: true,
            data: { id, ...data, createdAt: nowMs }
        }, 201);
    }
);

/**
 * PUT /api/v1/files/:id - 更新文件
 */
app.put('/:id',
    requirePermission('files:write'),
    async (c) => {
        const id = c.req.param('id');
        const data = await c.req.json();
        const { env } = c;

        const file = await env.DB.prepare('SELECT id FROM files WHERE id = ?').bind(id).first();
        if (!file) {
            return c.json({ success: false, error: MSG.FILE.NOT_FOUND }, 404);
        }

        const updates = [];
        const values = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.folderId !== undefined) {
            updates.push('folder_id = ?');
            values.push(data.folderId);
        }
        if (data.isPublic !== undefined) {
            updates.push('is_public = ?');
            values.push(data.isPublic ? 1 : 0);
        }

        if (updates.length === 0) {
            return c.json({ success: false, error: MSG.COMMON.NO_UPDATE_FIELDS }, 400);
        }

        updates.push('updated_at = ?');
        values.push(now());
        values.push(id);

        await env.DB.prepare(
            `UPDATE files SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...values).run();

        // 失效缓存
        await invalidateCache(c.req.url);

        return c.json({ success: true, message: MSG.FILE.UPDATE_SUCCESS });
    }
);

/**
 * DELETE /api/v1/files/:id - 删除文件
 */
app.delete('/:id',
    requirePermission('files:delete'),
    async (c) => {
        const id = c.req.param('id');
        const { env } = c;

        const file = await env.DB.prepare('SELECT storage_key, content_hash FROM files WHERE id = ?').bind(id).first();
        if (!file) {
            return c.json({ success: false, error: MSG.FILE.NOT_FOUND }, 404);
        }

        // CAS: 如果有 content_hash，使用引用计数；否则直接删除 R2
        if (file.content_hash) {
            await decrementRefCount(env, file.content_hash);
        } else if (file.storage_key && env.R2_BUCKET) {
            await env.R2_BUCKET.delete(file.storage_key);
        }

        // 删除数据库记录
        await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();

        return c.json({ success: true, message: MSG.FILE.DELETE_SUCCESS });
    }
);

/**
 * POST /api/v1/files/batch/delete - 批量删除文件
 */
app.post('/batch/delete',
    requirePermission('files:delete'),
    zValidator('json', BatchFileSchema),
    async (c) => {
        const { ids } = c.req.valid('json');
        const { env } = c;

        // 获取存储键和内容哈希
        const placeholders = ids.map(() => '?').join(',');
        const { results } = await env.DB.prepare(
            `SELECT id, storage_key, content_hash FROM files WHERE id IN (${placeholders})`
        ).bind(...ids).all();

        // CAS: 分别处理有 content_hash 和没有的文件
        for (const f of results) {
            if (f.content_hash) {
                await decrementRefCount(env, f.content_hash);
            } else if (f.storage_key && env.R2_BUCKET) {
                await env.R2_BUCKET.delete(f.storage_key).catch(() => { });
            }
        }

        // 批量删除数据库记录
        await batchDelete(env.DB, 'files', ids);

        return c.json({
            success: true,
            message: MSG.FILE.BATCH_DELETE_SUCCESS.replace('{count}', results.length)
        });
    }
);

/**
 * POST /api/v1/files/batch/move - 批量移动文件
 */
app.post('/batch/move',
    requirePermission('files:write'),
    zValidator('json', MoveFileSchema),
    async (c) => {
        const { ids, targetFolderId } = c.req.valid('json');
        const { env } = c;

        // 验证目标文件夹存在（如果不是根目录）
        if (targetFolderId) {
            const folder = await env.DB.prepare(
                'SELECT id FROM folders WHERE id = ?'
            ).bind(targetFolderId).first();

            if (!folder) {
                return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
            }
        }

        // 批量更新
        const placeholders = ids.map(() => '?').join(',');
        await env.DB.prepare(
            `UPDATE files SET folder_id = ?, updated_at = ? WHERE id IN (${placeholders})`
        ).bind(targetFolderId, now(), ...ids).run();

        return c.json({
            success: true,
            message: MSG.FILE.MOVE_SUCCESS.replace('{count}', ids.length)
        });
    }
);

export default app;
