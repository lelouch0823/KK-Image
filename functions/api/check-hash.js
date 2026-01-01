/**
 * 预检查 API - 检查原始文件 hash 是否已存在
 * POST /api/check-hash
 * 
 * 用于在压缩前检查原始文件是否已上传过，实现跨设备/浏览器的秒传
 */

import { success, error } from './utils/response.js';
import { MSG } from './utils/messages.js';

/**
 * POST - 检查 original_hash 是否已存在
 * Request: { original_hash: string }
 * Response: { exists: boolean, file?: { id, url, name, ... } }
 */
export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        const body = await request.json();
        const { original_hash } = body;

        if (!original_hash) {
            return error('original_hash is required', 400);
        }

        // 查找是否有相同 original_hash 的文件
        const existingFile = await env.DB.prepare(
            'SELECT id, name, storage_key, mime_type, size FROM files WHERE original_hash = ? LIMIT 1'
        ).bind(original_hash).first();

        if (existingFile) {
            return success({
                exists: true,
                file: {
                    id: existingFile.id,
                    name: existingFile.name,
                    url: `/file/${existingFile.storage_key}`,
                    mimeType: existingFile.mime_type,
                    size: existingFile.size,
                    instantUpload: true // 标记为秒传
                }
            }, MSG.FILE.INSTANT_UPLOAD);
        }

        return success({ exists: false });

    } catch (err) {
        console.error('Check hash error:', err);
        return error(`${MSG.COMMON.CHECK_FAILED}: ${err.message}`, 500);
    }
}
