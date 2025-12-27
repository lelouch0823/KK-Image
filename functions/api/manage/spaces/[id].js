/**
 * 空间详情 API
 * GET /api/manage/spaces/:id - 获取空间详情
 * PUT /api/manage/spaces/:id - 更新空间
 * DELETE /api/manage/spaces/:id - 删除空间
 */

import { generateShareToken } from '../../utils/id.js';
import { success, error } from '../../utils/response.js';
import { getShareUrl, getFileUrl } from '../../utils/url.js';

export async function onRequestGet(context) {
    const { env, params } = context;
    const spaceId = params.id;

    try {
        const space = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(spaceId).first();

        if (!space) {
            return error('空间不存在', 404);
        }

        // 获取空间中的文件
        const { results: files } = await env.DB.prepare(`
            SELECT sf.*, f.name, f.original_name, f.size, f.mime_type, f.storage_key, f.created_at as file_created_at
            FROM space_files sf
            JOIN files f ON sf.file_id = f.id
            WHERE sf.space_id = ?
            ORDER BY sf.section ASC, sf.sort_order ASC, sf.added_at DESC
        `).bind(spaceId).all();

        // 获取子空间
        const { results: subspaces } = await env.DB.prepare(`
            SELECT id, name, template, 
                   (SELECT COUNT(*) FROM space_files WHERE space_id = spaces.id) as file_count
            FROM spaces 
            WHERE parent_id = ?
            ORDER BY sort_order ASC, name ASC
        `).bind(spaceId).all();

        // 获取面包屑路径
        const breadcrumbs = await getBreadcrumbs(env.DB, spaceId);

        return success({
            id: space.id,
            parentId: space.parent_id,
            name: space.name,
            description: space.description,
            template: space.template,
            templateData: space.template_data ? JSON.parse(space.template_data) : null,
            coverFileId: space.cover_file_id,
            shareToken: space.share_token,
            isPublic: Boolean(space.is_public),
            password: space.password ? '******' : null,
            expiresAt: space.expires_at,
            viewCount: space.view_count,
            downloadCount: space.download_count,
            createdAt: space.created_at,
            updatedAt: space.updated_at,
            shareUrl: space.share_token ? `/space/${space.share_token}` : null,
            breadcrumbs,
            subspaces: subspaces.map(s => ({
                id: s.id,
                name: s.name,
                template: s.template,
                fileCount: s.file_count
            })),
            files: files.map(f => ({
                id: f.file_id,
                section: f.section,
                sortOrder: f.sort_order,
                name: f.name,
                originalName: f.original_name,
                size: f.size,
                mimeType: f.mime_type,
                url: getFileUrl(f.storage_key),
                addedAt: f.added_at
            }))
        });
    } catch (err) {
        console.error('获取空间详情失败:', err);
        return error(err.message, 500);
    }
}

export async function onRequestPut(context) {
    const { request, env, params } = context;
    const spaceId = params.id;

    try {
        const space = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(spaceId).first();
        if (!space) {
            return error('空间不存在', 404);
        }

        const body = await request.json();
        const updates = [];
        const values = [];

        // 可更新字段
        const fields = ['name', 'description', 'template', 'is_public', 'password', 'expires_at', 'cover_file_id', 'sort_order', 'parent_id'];

        if (body.name !== undefined) {
            updates.push('name = ?');
            values.push(body.name.trim());
        }
        if (body.description !== undefined) {
            updates.push('description = ?');
            values.push(body.description.trim());
        }
        if (body.template !== undefined) {
            const validTemplates = ['gallery', 'product', 'portfolio', 'document', 'custom'];
            if (!validTemplates.includes(body.template)) {
                return error('无效的模版类型', 400);
            }
            updates.push('template = ?');
            values.push(body.template);
        }
        if (body.templateData !== undefined) {
            updates.push('template_data = ?');
            values.push(JSON.stringify(body.templateData));
        }
        if (body.isPublic !== undefined) {
            updates.push('is_public = ?');
            values.push(body.isPublic ? 1 : 0);
        }
        if (body.password !== undefined) {
            updates.push('password = ?');
            values.push(body.password || null);
        }
        if (body.expiresAt !== undefined) {
            updates.push('expires_at = ?');
            values.push(body.expiresAt);
        }
        if (body.coverFileId !== undefined) {
            updates.push('cover_file_id = ?');
            values.push(body.coverFileId);
        }
        if (body.parentId !== undefined) {
            updates.push('parent_id = ?');
            values.push(body.parentId);
        }

        // 重新生成分享链接
        if (body.regenerateToken) {
            const newToken = generateShareToken();
            updates.push('share_token = ?');
            values.push(newToken);
        }

        if (updates.length === 0) {
            return error('没有要更新的字段', 400);
        }

        updates.push('updated_at = ?');
        values.push(Date.now());
        values.push(spaceId);

        await env.DB.prepare(`
            UPDATE spaces SET ${updates.join(', ')} WHERE id = ?
        `).bind(...values).run();

        const updated = await env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(spaceId).first();

        return success({
            id: updated.id,
            name: updated.name,
            description: updated.description,
            template: updated.template,
            isPublic: Boolean(updated.is_public),
            shareToken: updated.share_token,
            shareUrl: updated.share_token ? `/space/${updated.share_token}` : null,
            updatedAt: updated.updated_at
        });
    } catch (err) {
        console.error('更新空间失败:', err);
        return error(err.message, 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const spaceId = params.id;

    try {
        const space = await env.DB.prepare('SELECT id FROM spaces WHERE id = ?').bind(spaceId).first();
        if (!space) {
            return error('空间不存在', 404);
        }

        // 级联删除由数据库外键处理（子空间、space_files、access_logs）
        await env.DB.prepare('DELETE FROM spaces WHERE id = ?').bind(spaceId).run();

        return success(null, '空间已删除');
    } catch (err) {
        console.error('删除空间失败:', err);
        return error(err.message, 500);
    }
}

// 递归获取面包屑路径
async function getBreadcrumbs(db, spaceId) {
    const breadcrumbs = [];
    let currentId = spaceId;

    while (currentId) {
        const space = await db.prepare('SELECT id, parent_id, name FROM spaces WHERE id = ?').bind(currentId).first();
        if (!space) break;
        breadcrumbs.unshift({ id: space.id, name: space.name });
        currentId = space.parent_id;
    }

    return breadcrumbs;
}
