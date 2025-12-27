/**
 * 文件夹上传 API
 * POST /api/manage/folders/:id/upload - 上传文件到指定文件夹
 */

import { getFileUrl } from '../../../utils/url.js';

// 生成唯一 ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// 获取文件扩展名
function getExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

// 获取 MIME 类型
function getMimeType(ext) {
    const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'bmp': 'image/bmp',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

export async function onRequestPost(context) {
    const { request, env, params } = context;
    const folderId = params.id;

    try {
        // 验证文件夹存在
        const folder = await env.DB.prepare('SELECT id FROM folders WHERE id = ?').bind(folderId).first();
        if (!folder) {
            return new Response(JSON.stringify({
                success: false,
                message: '文件夹不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 解析 multipart form data
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return new Response(JSON.stringify({
                success: false,
                message: '未提供文件'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const originalName = file.name;
        const ext = getExtension(originalName);
        const fileId = generateId();
        const storageKey = `${fileId}.${ext}`;
        const size = file.size;
        const mimeType = getMimeType(ext);
        const now = Date.now();

        // 读取文件内容
        const arrayBuffer = await file.arrayBuffer();

        // 存储到 R2
        if (env.R2_BUCKET) {
            await env.R2_BUCKET.put(storageKey, arrayBuffer, {
                httpMetadata: {
                    contentType: mimeType,
                },
                customMetadata: {
                    originalName: originalName,
                    folderId: folderId,
                    uploadedAt: now.toString(),
                }
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                message: 'R2 存储未配置'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 保存到 D1 数据库
        await env.DB.prepare(`
      INSERT INTO files (id, folder_id, name, original_name, size, mime_type, storage_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
            fileId,
            folderId,
            storageKey,
            originalName,
            size,
            mimeType,
            storageKey,
            now
        ).run();

        // 同时更新 KV（保持向后兼容）
        if (env.img_url) {
            await env.img_url.put(storageKey, JSON.stringify({
                fileName: originalName,
                fileSize: size,
                mimeType: mimeType,
                TimeStamp: now,
                folderId: folderId
            }));
        }

        return new Response(JSON.stringify({
            success: true,
            data: {
                id: fileId,
                name: storageKey,
                originalName: originalName,
                size: size,
                mimeType: mimeType,
                url: getFileUrl(storageKey),
                createdAt: now
            }
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('上传文件失败:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// DELETE - 删除文件夹内的单个文件
export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const folderId = params.id;

    try {
        const url = new URL(request.url);
        const fileId = url.searchParams.get('file_id');

        if (!fileId) {
            return new Response(JSON.stringify({
                success: false,
                message: '未提供文件 ID'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证文件属于该文件夹
        const file = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND folder_id = ?').bind(fileId, folderId).first();

        if (!file) {
            return new Response(JSON.stringify({
                success: false,
                message: '文件不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 从 R2 删除
        if (env.R2_BUCKET) {
            await env.R2_BUCKET.delete(file.storage_key).catch(() => { });
        }

        // 从 KV 删除
        if (env.img_url) {
            await env.img_url.delete(file.storage_key).catch(() => { });
        }

        // 从 D1 删除
        await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run();

        return new Response(JSON.stringify({
            success: true,
            message: '文件已删除'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('删除文件失败:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
