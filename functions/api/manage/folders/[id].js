/**
 * 单个文件夹操作 API
 * GET /api/manage/folders/:id - 获取文件夹详情（包含子文件夹和文件）
 * PUT /api/manage/folders/:id - 更新文件夹
 * DELETE /api/manage/folders/:id - 删除文件夹（级联删除）
 */

import { jsonResponse, success, error } from '../../utils/response.js';

export async function onRequestGet(context) {
    const { env, params } = context;
    const folderId = params.id;

    try {
        // 获取文件夹信息
        const folder = await env.DB.prepare(`
      SELECT * FROM folders WHERE id = ?
    `).bind(folderId).first();

        if (!folder) return error('文件夹不存在', 404);

        // 获取子文件夹
        const { results: subfolders } = await env.DB.prepare(`
      SELECT f.*, 
             (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
             (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
      FROM folders f 
      WHERE f.parent_id = ?
      ORDER BY f.name ASC
    `).bind(folderId).all();

        // 获取文件
        const { results: files } = await env.DB.prepare(`
      SELECT * FROM files WHERE folder_id = ? ORDER BY created_at DESC
    `).bind(folderId).all();

        // 获取面包屑路径
        const breadcrumbs = await getBreadcrumbs(env.DB, folderId);

        return success({
            id: folder.id,
            name: folder.name,
            description: folder.description,
            parentId: folder.parent_id,
            shareToken: folder.share_token,
            isPublic: Boolean(folder.is_public),
            password: folder.password ? true : false, // 不返回实际密码
            createdAt: folder.created_at,
            updatedAt: folder.updated_at,
            shareUrl: folder.share_token ? `/gallery/${folder.share_token}` : null,
            breadcrumbs,
            subfolders: subfolders.map(f => ({
                id: f.id,
                name: f.name,
                subfolderCount: f.subfolder_count,
                fileCount: f.file_count,
                isPublic: Boolean(f.is_public),
                createdAt: f.created_at
            })),
            files: files.map(f => ({
                id: f.id,
                name: f.name,
                originalName: f.original_name,
                size: f.size,
                mimeType: f.mime_type,
                storageKey: f.storage_key,
                url: `/file/${f.storage_key}`,
                createdAt: f.created_at
            }))
        });
    } catch (err) {
        console.error('获取文件夹详情失败:', err);
        return error(err.message, 500);
    }
}

// 递归获取面包屑路径
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

export async function onRequestPut(context) {
    const { request, env, params } = context;
    const folderId = params.id;

    try {
        const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(folderId).first();

        if (!folder) return error('文件夹不存在', 404);

        const body = await request.json();
        const { name, description, isPublic, password, parentId } = body;

        // 构建更新语句
        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name.trim());
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description.trim());
        }
        if (isPublic !== undefined) {
            updates.push('is_public = ?');
            values.push(isPublic ? 1 : 0);
        }
        if (password !== undefined) {
            updates.push('password = ?');
            values.push(password || null);
        }
        if (parentId !== undefined) {
            // 防止循环引用
            if (parentId === folderId) return error('不能将文件夹移动到自身', 400);
            updates.push('parent_id = ?');
            values.push(parentId);
        }

        // New: Handle shareExpiresAt
        const { shareExpiresAt } = body;
        if (shareExpiresAt !== undefined) {
            updates.push('share_expires_at = ?');
            values.push(shareExpiresAt); // Can be null (Permanent) or timestamp
        }

        // Auto-generate share_token if enabling sharing and none exists
        if ((isPublic === true || shareExpiresAt !== undefined) && !folder.share_token) {
            const token = Math.random().toString(36).substring(2, 14); // Simple token
            updates.push('share_token = ?');
            values.push(token);
        }

        updates.push('updated_at = ?');
        values.push(Date.now());
        values.push(folderId);

        await env.DB.prepare(`
      UPDATE folders SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

        // 返回更新后的文件夹
        const updated = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(folderId).first();

        return success({
            ...updated,
            isPublic: Boolean(updated.is_public),
            shareUrl: updated.share_token ? `/gallery/${updated.share_token}` : null
        });
    } catch (err) {
        console.error('更新文件夹失败:', err);
        return error(err.message, 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const folderId = params.id;

    try {
        // 禁止删除根文件夹
        if (folderId === 'root') return error('不能删除根文件夹', 400);

        const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(folderId).first();

        if (!folder) return error('文件夹不存在', 404);

        // 级联删除由数据库外键处理
        // 但我们需要先删除 R2 中的文件
        const { results: files } = await env.DB.prepare(`
      WITH RECURSIVE subfolder_tree AS (
        SELECT id FROM folders WHERE id = ?
        UNION ALL
        SELECT f.id FROM folders f
        JOIN subfolder_tree st ON f.parent_id = st.id
      )
      SELECT storage_key FROM files WHERE folder_id IN (SELECT id FROM subfolder_tree)
    `).bind(folderId).all();

        // 从 R2 删除文件（如果有 R2 绑定）
        if (context.env.R2_BUCKET && files.length > 0) {
            await Promise.all(files.map(f =>
                context.env.R2_BUCKET.delete(f.storage_key).catch(() => { })
            ));
        }

        // 删除文件夹（级联删除子文件夹和文件）
        await env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(folderId).run();

        return success(null, '文件夹已删除');
    } catch (err) {
        console.error('删除文件夹失败:', err);
        return error(err.message, 500);
    }
}
