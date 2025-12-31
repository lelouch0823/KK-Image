/**
 * 检查文件哈希是否已存在（秒传检查）
 * GET /api/manage/check-hash?hash=sha256_xxx
 */

import { success, error } from '../utils/response.js';
import { getBlobByHash } from '../utils/blob-utils.js';

export async function onRequestGet(context) {
    const { env, request } = context;

    try {
        const url = new URL(request.url);
        const hash = url.searchParams.get('hash');

        if (!hash) {
            return error('Missing hash parameter', 400);
        }

        // 检查 blob 是否存在
        const blob = await getBlobByHash(env, hash);

        if (blob) {
            // 文件已存在，可以秒传
            return success({
                exists: true,
                contentHash: blob.content_hash,
                size: blob.size,
                mimeType: blob.mime_type
            });
        } else {
            // 文件不存在，需要上传
            return new Response(JSON.stringify({
                success: true,
                data: { exists: false }
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (err) {
        console.error('Check hash error:', err);
        return error(`检查失败: ${err.message}`, 500);
    }
}
