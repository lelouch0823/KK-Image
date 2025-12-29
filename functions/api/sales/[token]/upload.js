/**
 * 销售端文件上传 API
 * POST /api/sales/:token/upload - 上传图片
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { generateId, now } from '../../utils/id.js';
import { authenticateSalesperson } from '../../utils/salesperson-auth.js';

/**
 * POST - 上传文件
 */
export async function onRequestPost(context) {
    const { env, params, request } = context;
    const accessToken = params.token;

    try {
        // 验证销售身份
        await authenticateSalesperson(request, env, accessToken);

        // 解析 FormData
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return error('请选择要上传的文件', 400);
        }

        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return error('仅支持 JPG、PNG、GIF、WebP 格式', 400);
        }

        // 验证文件大小 (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return error('文件大小不能超过 10MB', 400);
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
            name: file.name,
            size: file.size,
            type: file.type
        }, '上传成功');

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        if (err.message === MSG.SALESPERSON.DISABLED) {
            return error(err.message, 403);
        }
        console.error('Sales upload error:', err);
        return error(`上传失败: ${err.message}`, 500);
    }
}
