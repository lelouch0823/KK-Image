import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, generateShareToken } from '../../../../api/utils/id.js';
import { getShareUrl, getFileUrl } from '../../../../api/utils/url.js';
import { MSG } from '../../../../api/utils/messages.js';

const app = new Hono();

// Schemas
const CreateSpaceSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().default(''),
    isPublic: z.boolean().optional().default(false),
    password: z.string().min(4).max(50).optional().nullable(),
    expiresAt: z.number().optional().nullable()
});

const UpdateSpaceSchema = CreateSpaceSchema.partial();

/**
 * GET /api/manage/spaces - 获取共享空间列表
 */
app.get('/', async (c) => {
    const { env } = c;

    try {
        const { results } = await env.DB.prepare(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM space_files WHERE space_id = s.id) as file_count
      FROM spaces s ORDER BY s.updated_at DESC
    `).all();

        return c.json({
            success: true,
            data: results.map(space => ({
                id: space.id,
                name: space.name,
                description: space.description,
                isPublic: Boolean(space.is_public),
                hasPassword: !!space.password,
                shareToken: space.share_token,
                shareUrl: getShareUrl(space.share_token, 'space'),
                fileCount: space.file_count,
                expiresAt: space.expires_at,
                createdAt: space.created_at,
                updatedAt: space.updated_at
            }))
        });
    } catch (err) {
        console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

/**
 * GET /api/manage/spaces/:id - 获取共享空间详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const spaceId = c.req.param('id');

    try {
        const space = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(spaceId).first();
        if (!space) {
            return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
        }

        // 获取空间文件
        const { results: files } = await env.DB.prepare(`
      SELECT f.* FROM files f
      JOIN space_files sf ON f.id = sf.file_id
      WHERE sf.space_id = ?
      ORDER BY sf.sort_order ASC, f.created_at DESC
    `).bind(spaceId).all();

        return c.json({
            success: true,
            data: {
                id: space.id,
                name: space.name,
                description: space.description,
                isPublic: Boolean(space.is_public),
                hasPassword: !!space.password,
                shareToken: space.share_token,
                shareUrl: getShareUrl(space.share_token, 'space'),
                expiresAt: space.expires_at,
                createdAt: space.created_at,
                updatedAt: space.updated_at,
                files: files.map(f => ({
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
 * GET /api/manage/spaces/:id/stats - 获取空间统计
 */
app.get('/:id/stats', async (c) => {
    const { env } = c;
    const spaceId = c.req.param('id');

    try {
        const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as file_count,
        COALESCE(SUM(f.size), 0) as total_size
      FROM files f
      JOIN space_files sf ON f.id = sf.file_id
      WHERE sf.space_id = ?
    `).bind(spaceId).first();

        return c.json({
            success: true,
            data: {
                fileCount: stats?.file_count || 0,
                totalSize: stats?.total_size || 0
            }
        });
    } catch (err) {
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

/**
 * POST /api/manage/spaces - 创建共享空间
 */
app.post('/',
    requirePermission('files:write'),
    zValidator('json', CreateSpaceSchema),
    async (c) => {
        const { env } = c;
        const { name, description, isPublic, password, expiresAt } = c.req.valid('json');

        try {
            const spaceId = generateId();
            const shareToken = generateShareToken();
            const nowMs = Date.now();

            await env.DB.prepare(`
        INSERT INTO spaces (id, name, description, is_public, password, share_token, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(spaceId, name.trim(), description.trim(), isPublic ? 1 : 0, password || null, shareToken, expiresAt || null, nowMs, nowMs).run();

            return c.json({
                success: true,
                data: {
                    id: spaceId,
                    name: name.trim(),
                    description: description.trim(),
                    isPublic,
                    shareToken,
                    shareUrl: getShareUrl(shareToken, 'space'),
                    expiresAt,
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
 * PUT /api/manage/spaces/:id - 更新共享空间
 */
app.put('/:id',
    requirePermission('files:write'),
    zValidator('json', UpdateSpaceSchema),
    async (c) => {
        const { env } = c;
        const spaceId = c.req.param('id');
        const data = c.req.valid('json');

        try {
            const space = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(spaceId).first();
            if (!space) {
                return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
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
            if (data.expiresAt !== undefined) {
                updates.push('expires_at = ?');
                values.push(data.expiresAt);
            }

            updates.push('updated_at = ?');
            values.push(Date.now());
            values.push(spaceId);

            await env.DB.prepare(`UPDATE spaces SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

            const updated = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(spaceId).first();

            return c.json({
                success: true,
                data: {
                    ...updated,
                    isPublic: Boolean(updated.is_public),
                    hasPassword: !!updated.password,
                    shareUrl: getShareUrl(updated.share_token, 'space')
                }
            });
        } catch (err) {
            console.error(`${MSG.COMMON.UPDATE_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.UPDATE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * DELETE /api/manage/spaces/:id - 删除共享空间
 */
app.delete('/:id',
    requirePermission('files:delete'),
    async (c) => {
        const { env } = c;
        const spaceId = c.req.param('id');

        try {
            const space = await env.DB.prepare('SELECT id FROM spaces WHERE id = ?').bind(spaceId).first();
            if (!space) {
                return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
            }

            await env.DB.batch([
                env.DB.prepare('DELETE FROM space_files WHERE space_id = ?').bind(spaceId),
                env.DB.prepare('DELETE FROM spaces WHERE id = ?').bind(spaceId)
            ]);

            return c.json({ success: true, message: MSG.SPACE.DELETE_SUCCESS });
        } catch (err) {
            console.error(`${MSG.COMMON.DELETE_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.DELETE_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * POST /api/manage/spaces/:id/files - 添加文件到空间
 */
app.post('/:id/files',
    requirePermission('files:write'),
    async (c) => {
        const { env } = c;
        const spaceId = c.req.param('id');
        const { fileIds } = await c.req.json();

        try {
            if (!fileIds?.length) {
                return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);
            }

            const space = await env.DB.prepare('SELECT id FROM spaces WHERE id = ?').bind(spaceId).first();
            if (!space) {
                return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
            }

            const statements = fileIds.map((fileId, index) =>
                env.DB.prepare('INSERT OR IGNORE INTO space_files (space_id, file_id, sort_order) VALUES (?, ?, ?)')
                    .bind(spaceId, fileId, index)
            );

            await env.DB.batch(statements);
            await env.DB.prepare('UPDATE spaces SET updated_at = ? WHERE id = ?').bind(Date.now(), spaceId).run();

            return c.json({
                success: true,
                message: MSG.SPACE.ADD_FILES_SUCCESS.replace('{count}', fileIds.length)
            });
        } catch (err) {
            console.error(`${MSG.COMMON.OP_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
        }
    }
);

/**
 * DELETE /api/manage/spaces/:id/files - 从空间移除文件
 */
app.delete('/:id/files',
    requirePermission('files:write'),
    async (c) => {
        const { env } = c;
        const spaceId = c.req.param('id');
        const { fileIds } = await c.req.json();

        try {
            if (!fileIds?.length) {
                return c.json({ success: false, error: MSG.COMMON.INVALID_PARAMS }, 400);
            }

            const placeholders = fileIds.map(() => '?').join(',');
            await env.DB.prepare(
                `DELETE FROM space_files WHERE space_id = ? AND file_id IN (${placeholders})`
            ).bind(spaceId, ...fileIds).run();

            return c.json({
                success: true,
                message: MSG.SPACE.REMOVE_FILES_SUCCESS.replace('{count}', fileIds.length)
            });
        } catch (err) {
            console.error(`${MSG.COMMON.OP_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.OP_FAILED}: ${err.message}` }, 500);
        }
    }
);

export default app;
