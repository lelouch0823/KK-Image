/**
 * 空间文件管理 API
 * POST /api/manage/spaces/:id/files - 添加文件到空间
 * DELETE /api/manage/spaces/:id/files - 从空间移除文件
 * PUT /api/manage/spaces/:id/files - 更新文件排序/区块
 */

import { generateId } from '../../../utils/id.js';
import { success, error } from '../../../utils/response.js';

export async function onRequestPost(context) {
    const { request, env, params } = context;
    const spaceId = params.id;

    try {
        // 验证空间存在
        const space = await env.DB.prepare('SELECT id FROM spaces WHERE id = ?').bind(spaceId).first();
        if (!space) {
            return error('空间不存在', 404);
        }

        const body = await request.json();
        const { fileIds, section = 'default' } = body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return error('请提供文件ID列表', 400);
        }

        // 验证文件存在
        const placeholders = fileIds.map(() => '?').join(',');
        const { results: existingFiles } = await env.DB.prepare(
            `SELECT id FROM files WHERE id IN (${placeholders})`
        ).bind(...fileIds).all();

        if (existingFiles.length === 0) {
            return error('没有找到有效的文件', 400);
        }

        const validFileIds = existingFiles.map(f => f.id);
        const now = Date.now();
        let addedCount = 0;

        // 获取当前最大排序值
        const maxSort = await env.DB.prepare(
            `SELECT MAX(sort_order) as max_order FROM space_files WHERE space_id = ? AND section = ?`
        ).bind(spaceId, section).first();
        let sortOrder = (maxSort?.max_order || 0) + 1;

        // 逐个添加（处理重复）
        for (const fileId of validFileIds) {
            try {
                await env.DB.prepare(`
                    INSERT INTO space_files (id, space_id, file_id, section, sort_order, added_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).bind(generateId(), spaceId, fileId, section, sortOrder++, now).run();
                addedCount++;
            } catch (e) {
                // UNIQUE 约束冲突，跳过已存在的
                if (!e.message.includes('UNIQUE constraint')) {
                    throw e;
                }
            }
        }

        return success({
            addedCount,
            skippedCount: validFileIds.length - addedCount,
            message: `成功添加 ${addedCount} 个文件`
        });
    } catch (err) {
        console.error('添加文件到空间失败:', err);
        return error(err.message, 500);
    }
}

export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const spaceId = params.id;

    try {
        const space = await env.DB.prepare('SELECT id FROM spaces WHERE id = ?').bind(spaceId).first();
        if (!space) {
            return error('空间不存在', 404);
        }

        const body = await request.json();
        const { fileIds } = body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return error('请提供文件ID列表', 400);
        }

        const placeholders = fileIds.map(() => '?').join(',');
        const result = await env.DB.prepare(
            `DELETE FROM space_files WHERE space_id = ? AND file_id IN (${placeholders})`
        ).bind(spaceId, ...fileIds).run();

        return success({
            removedCount: result.changes || 0,
            message: `已从空间中移除文件`
        });
    } catch (err) {
        console.error('从空间移除文件失败:', err);
        return error(err.message, 500);
    }
}

export async function onRequestPut(context) {
    const { request, env, params } = context;
    const spaceId = params.id;

    try {
        const space = await env.DB.prepare('SELECT id FROM spaces WHERE id = ?').bind(spaceId).first();
        if (!space) {
            return error('空间不存在', 404);
        }

        const body = await request.json();
        const { files } = body;

        if (!files || !Array.isArray(files)) {
            return error('请提供文件排序列表', 400);
        }

        // 批量更新排序和区块
        for (const file of files) {
            if (!file.fileId) continue;

            const updates = [];
            const values = [];

            if (file.sortOrder !== undefined) {
                updates.push('sort_order = ?');
                values.push(file.sortOrder);
            }
            if (file.section !== undefined) {
                updates.push('section = ?');
                values.push(file.section);
            }

            if (updates.length > 0) {
                values.push(spaceId, file.fileId);
                await env.DB.prepare(
                    `UPDATE space_files SET ${updates.join(', ')} WHERE space_id = ? AND file_id = ?`
                ).bind(...values).run();
            }
        }

        return success({ message: '排序已更新' });
    } catch (err) {
        console.error('更新文件排序失败:', err);
        return error(err.message, 500);
    }
}
