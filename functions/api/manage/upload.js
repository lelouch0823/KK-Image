/**
 * 管理端文件上传 API
 * POST /api/manage/upload - 上传图片
 * Query params:
 *   - orderId: 订单ID (可选，如果提供则直接归档到订单文件夹)
 *   - contentHash: SHA-256 哈希 (可选，用于秒传检测)
 */

import { success, error } from '../utils/response.js';
import { generateId, now } from '../utils/id.js';
import { MSG } from '../utils/messages.js';
import { ensureFolder } from '../utils/folder-utils.js';
import { getBlobByHash, createBlob, incrementRefCount } from '../utils/blob-utils.js';

/**
 * POST - 上传文件
 */
export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        // 解析查询参数
        const url = new URL(request.url);
        const orderId = url.searchParams.get('orderId');
        const contentHash = url.searchParams.get('contentHash');

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

        // 确定目标文件夹
        let folderId = 'root';
        if (orderId) {
            try {
                const order = await env.DB.prepare(
                    'SELECT order_no FROM orders WHERE id = ?'
                ).bind(orderId).first();

                if (order && order.order_no) {
                    const rootId = await ensureFolder(env, 'Uploads', 'root');
                    const subId = await ensureFolder(env, 'Orders', rootId);
                    folderId = await ensureFolder(env, order.order_no, subId);
                }
            } catch (e) {
                console.error('Archive folder creation error:', e);
            }
        }

        let storageKey;
        let isInstantUpload = false;

        // 检查是否可以秒传（blob 已存在）
        if (contentHash) {
            const existingBlob = await getBlobByHash(env, contentHash);
            if (existingBlob) {
                // 秒传：增加引用计数，复用已有 blob
                await incrementRefCount(env, contentHash);
                storageKey = contentHash;
                isInstantUpload = true;
            }
        }

        // 如果不是秒传，需要实际上传
        if (!storageKey) {
            // 使用 content_hash 作为 storage_key（如果提供），否则生成随机 key
            storageKey = contentHash || `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

            // 上传到 R2
            await env.R2_BUCKET.put(storageKey, file.stream(), {
                httpMetadata: { contentType: file.type },
            });

            // 如果提供了 hash，创建 blob 记录
            if (contentHash) {
                await createBlob(env, contentHash, file.size, file.type);
            }
        }

        // 保存到数据库
        const fileId = generateId();
        const timestamp = now();

        await env.DB.prepare(`
            INSERT INTO files (id, name, storage_key, original_name, mime_type, size, folder_id, content_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(fileId, file.name, storageKey, file.name, file.type, file.size, folderId, contentHash || null, timestamp, timestamp).run();

        return success({
            id: fileId,
            storage_key: storageKey,
            storageKey: storageKey,
            name: file.name,
            size: file.size,
            type: file.type,
            url: `/file/${storageKey}`,
            instantUpload: isInstantUpload
        }, isInstantUpload ? '秒传成功' : MSG.FILE.UPLOAD_SUCCESS);

    } catch (err) {
        console.error('Admin upload error:', err);
        return error(`上传失败: ${err.message}`, 500);
    }
}
