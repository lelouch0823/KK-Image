/**
 * 空间文件操作路由
 * POST /:id/files - 添加文件
 * DELETE /:id/files - 移除文件
 */

import { Hono } from 'hono';
import { requirePermission } from '../../../middleware/auth.js';
import { MSG } from '../../../_shared/utils.js';

const files = new Hono();

/**
 * POST /files - 添加文件到空间
 */
files.post('/',
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
                env.DB.prepare('INSERT INTO space_files (space_id, file_id, sort_order, added_at) VALUES (?, ?, ?, ?)')
                    .bind(spaceId, fileId, index, Date.now())
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
 * DELETE /files - 从空间移除文件
 */
files.delete('/',
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

export default files;
