/**
 * 空间列表与创建 API
 * GET /api/manage/spaces - 获取空间列表
 * POST /api/manage/spaces - 创建新空间
 */

import { generateId, generateShareToken } from '../../utils/id.js';
import { success, error } from '../../utils/response.js';

export async function onRequestGet(context) {
    const { env, request } = context;

    try {
        const url = new URL(request.url);
        const parentId = url.searchParams.get('parent_id') || null;

        let query;
        if (parentId) {
            query = env.DB.prepare(`
                SELECT s.*, 
                       (SELECT COUNT(*) FROM spaces WHERE parent_id = s.id) as subspace_count,
                       (SELECT COUNT(*) FROM space_files WHERE space_id = s.id) as file_count
                FROM spaces s 
                WHERE s.parent_id = ? 
                ORDER BY s.sort_order ASC, s.created_at DESC
            `).bind(parentId);
        } else {
            // 获取根级空间
            query = env.DB.prepare(`
                SELECT s.*, 
                       (SELECT COUNT(*) FROM spaces WHERE parent_id = s.id) as subspace_count,
                       (SELECT COUNT(*) FROM space_files WHERE space_id = s.id) as file_count
                FROM spaces s 
                WHERE s.parent_id IS NULL
                ORDER BY s.sort_order ASC, s.created_at DESC
            `);
        }

        const { results } = await query.all();

        return success(results.map(space => ({
            id: space.id,
            parentId: space.parent_id,
            name: space.name,
            description: space.description,
            template: space.template,
            coverFileId: space.cover_file_id,
            shareToken: space.share_token,
            isPublic: Boolean(space.is_public),
            expiresAt: space.expires_at,
            viewCount: space.view_count,
            downloadCount: space.download_count,
            subspaceCount: space.subspace_count,
            fileCount: space.file_count,
            createdAt: space.created_at,
            updatedAt: space.updated_at,
            shareUrl: space.share_token ? `/space/${space.share_token}` : null
        })));
    } catch (err) {
        console.error('获取空间列表失败:', err);
        return error(err.message, 500);
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const {
            name,
            description = '',
            template = 'gallery',
            templateData = null,
            parentId = null
        } = body;

        if (!name || name.trim() === '') {
            return error('空间名称不能为空', 400);
        }

        // 验证模版类型
        const validTemplates = ['gallery', 'product', 'portfolio', 'document', 'custom'];
        if (!validTemplates.includes(template)) {
            return error('无效的模版类型', 400);
        }

        // 如果指定了父空间，验证其存在性
        if (parentId) {
            const parent = await env.DB.prepare('SELECT id FROM spaces WHERE id = ?').bind(parentId).first();
            if (!parent) {
                return error('父空间不存在', 400);
            }
        }

        const spaceId = generateId();
        const shareToken = generateShareToken();
        const now = Date.now();

        await env.DB.prepare(`
            INSERT INTO spaces (id, parent_id, name, description, template, template_data, share_token, is_public, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).bind(
            spaceId,
            parentId,
            name.trim(),
            description.trim(),
            template,
            templateData ? JSON.stringify(templateData) : null,
            shareToken,
            now,
            now
        ).run();

        return success({
            id: spaceId,
            name: name.trim(),
            description: description.trim(),
            template,
            parentId,
            shareToken,
            shareUrl: `/space/${shareToken}`,
            createdAt: now
        }, 201);
    } catch (err) {
        console.error('创建空间失败:', err);
        return error(err.message, 500);
    }
}
