/**
 * 文件夹列表与创建 API
 * GET /api/manage/folders - 获取文件夹列表（支持 parent_id 参数）
 * POST /api/manage/folders - 创建新文件夹
 */

import { generateId, generateShareToken } from '../utils/id.js';
import { jsonResponse, success, error } from '../utils/response.js';

export async function onRequestGet(context) {
    const { env, request } = context;

    try {
        const url = new URL(request.url);
        const parentId = url.searchParams.get('parent_id') || null;

        const all = url.searchParams.get('all') === 'true';

        // 查询文件夹列表
        let query;
        if (all) {
            // 获取所有 folders (用于移动文件选择树)
            query = env.DB.prepare(`
        SELECT f.id, f.parent_id, f.name
        FROM folders f 
        WHERE f.id != 'root'
        ORDER BY f.name ASC
      `);
        } else if (parentId) {
            query = env.DB.prepare(`
        SELECT f.*, 
               (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
               (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
        FROM folders f 
        WHERE f.parent_id = ? 
        ORDER BY f.name ASC
      `).bind(parentId);
        } else {
            // 获取根级文件夹（parent_id 为 NULL，排除 root 文件夹本身）
            query = env.DB.prepare(`
        SELECT f.*, 
               (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count,
               (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
        FROM folders f 
        WHERE f.parent_id IS NULL AND f.id != 'root'
        ORDER BY f.name ASC
      `);
        }

        const { results } = await query.all();

        return success(results.map(folder => ({
            ...folder,
            isPublic: Boolean(folder.is_public),
            createdAt: folder.created_at,
            updatedAt: folder.updated_at,
            subfolderCount: folder.subfolder_count,
            fileCount: folder.file_count
        })));
    } catch (error) {
        console.error('获取文件夹列表失败:', error);
        return error(error.message, 500);
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { name, description = '', parentId = null, isPublic = false, password = null } = body;

        if (!name || name.trim() === '') {
            return error('文件夹名称不能为空', 400);
        }

        // 如果指定了父文件夹，验证其存在性
        if (parentId) {
            const parent = await env.DB.prepare('SELECT id FROM folders WHERE id = ?').bind(parentId).first();
            if (!parent) {
                return error('父文件夹不存在', 400);
            }
        }

        const folderId = generateId();
        const shareToken = generateShareToken();
        const now = Date.now();

        await env.DB.prepare(`
      INSERT INTO folders (id, parent_id, name, description, share_token, is_public, password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
            folderId,
            parentId,
            name.trim(),
            description.trim(),
            shareToken,
            isPublic ? 1 : 0,
            password,
            now,
            now
        ).run();

        return jsonResponse({
            success: true,
            data: {
                id: folderId,
                name: name.trim(),
                description: description.trim(),
                parentId,
                shareToken,
                isPublic,
                shareUrl: `/gallery/${shareToken}`,
                createdAt: now
            }
        }, 201);
    } catch (error) {
        console.error('创建文件夹失败:', error);
        return error(error.message, 500);
    }
}
