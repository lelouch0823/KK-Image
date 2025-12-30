/**
 * 管理端文件上传 API
 * POST /api/manage/upload - 上传图片
 */

import { success, error } from '../utils/response.js';
import { generateId, now } from '../utils/id.js';
import { MSG } from '../utils/messages.js';

/**
 * POST - 上传文件
 */
export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        // 解析 FormData
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return error(MSG.FILE.SELECT_FILE, 400);
        }

        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return error(MSG.FILE.INVALID_TYPE, 400);
        }

        // 验证文件大小 (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return error(MSG.FILE.SIZE_LIMIT, 400);
        }

        // 生成存储 key
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const storageKey = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${ext}`;

        // 上传到 R2
        await env.R2_BUCKET.put(storageKey, file.stream(), {
            httpMetadata: {
                contentType: file.type,
            },
        });

        // 保存到数据库
        const fileId = generateId();
        const timestamp = now();

        await env.DB.prepare(`
            INSERT INTO files (id, name, storage_key, original_name, mime_type, size, folder_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'root', ?, ?)
        `).bind(fileId, file.name, storageKey, file.name, file.type, file.size, timestamp, timestamp).run();

        return success({
            id: fileId,
            storage_key: storageKey,
            storageKey: storageKey, // 兼容前端字段
            name: file.name,
            size: file.size,
            type: file.type,
            url: `/file/${storageKey}`
        }, MSG.FILE.UPLOAD_SUCCESS);

    } catch (err) {
        console.error('Admin upload error:', err);
        return error(`上传失败: ${err.message}`, 500);
    }
}
