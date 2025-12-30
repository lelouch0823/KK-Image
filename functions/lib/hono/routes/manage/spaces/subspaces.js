/**
 * 子空间操作路由
 * GET /:id/subspaces - 获取子空间列表
 * POST /:id/subspaces - 创建子空间
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../../middleware/auth.js';
import { generateId, generateShareToken, MSG, getShareUrl, getFileUrl } from '../../../_shared/utils.js';
import { transformSpaceListItem } from './transformers.js';

const subspaces = new Hono();

// Schema
const CreateSubspaceSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().default(''),
    isPublic: z.boolean().optional().default(false),
    password: z.string().min(4).max(50).optional().nullable(),
    expiresAt: z.number().optional().nullable(),
    template: z.string().optional().default('gallery'),
    templateData: z.record(z.any()).optional().default({})
});

/**
 * GET / - 获取子空间列表
 */
subspaces.get('/', async (c) => {
    const { env } = c;
    const parentId = c.req.param('id');

    try {
        const { results } = await env.DB.prepare(`
            SELECT s.*, 
                (SELECT COUNT(*) FROM space_files WHERE space_id = s.id) as file_count,
                f.storage_key as cover_storage_key
            FROM spaces s
            LEFT JOIN files f ON s.cover_file_id = f.id
            WHERE s.parent_id = ?
            ORDER BY s.sort_order ASC, s.updated_at DESC
        `).bind(parentId).all();

        return c.json({
            success: true,
            data: results.map(transformSpaceListItem)
        });
    } catch (err) {
        console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
        return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
    }
});

/**
 * POST / - 创建子空间
 */
subspaces.post('/',
    requirePermission('files:write'),
    zValidator('json', CreateSubspaceSchema),
    async (c) => {
        const { env } = c;
        const parentId = c.req.param('id');
        const { name, description, isPublic, password, expiresAt, template, templateData } = c.req.valid('json');

        try {
            // 验证父空间存在
            const parent = await env.DB.prepare('SELECT id FROM spaces WHERE id = ?').bind(parentId).first();
            if (!parent) {
                return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);
            }

            const spaceId = generateId();
            const shareToken = generateShareToken();
            const nowMs = Date.now();

            await env.DB.prepare(`
                INSERT INTO spaces (id, parent_id, name, description, is_public, password, share_token, expires_at, template, template_data, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(spaceId, parentId, name.trim(), description.trim(), isPublic ? 1 : 0, password || null, shareToken, expiresAt || null, template, JSON.stringify(templateData), nowMs, nowMs).run();

            return c.json({
                success: true,
                data: {
                    id: spaceId,
                    parentId,
                    name: name.trim(),
                    description: description.trim(),
                    isPublic,
                    shareToken,
                    shareUrl: getShareUrl(shareToken, 'space'),
                    template,
                    createdAt: nowMs
                }
            }, 201);
        } catch (err) {
            console.error(`${MSG.COMMON.CREATE_FAILED}:`, err);
            return c.json({ success: false, error: `${MSG.COMMON.CREATE_FAILED}: ${err.message}` }, 500);
        }
    }
);

export default subspaces;
