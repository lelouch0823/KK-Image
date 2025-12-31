/**
 * 销售端文件上传 API
 * POST /api/sales/:token/upload - 上传图片
 * Query params:
 *   - orderId: 订单ID (可选，如果提供则直接归档到订单文件夹)
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { generateId, now } from '../../utils/id.js';
import { authenticateSalesperson } from '../../utils/salesperson-auth.js';
import { ensureFolder, moveFilesToFolder } from '../../utils/folder-utils.js';

/**
 * POST - 上传文件
 */
export async function onRequestPost(context) {
    const { env, params, request } = context;
    const accessToken = params.token;

    try {
        // 验证销售身份
        await authenticateSalesperson(request, env, accessToken);

        // 解析查询参数
        const url = new URL(request.url);
        const orderId = url.searchParams.get('orderId');

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

        // 确定目标文件夹
        let folderId = 'root';

        // 如果提供了 orderId，直接归档到订单文件夹
        if (orderId) {
            try {
                // 获取订单号
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
                // 失败时回退到 root
            }
        }

        // 保存到数据库
        const fileId = generateId();
        const timestamp = now();

        await env.DB.prepare(`
            INSERT INTO files (id, name, storage_key, original_name, mime_type, size, folder_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(fileId, file.name, storageKey, file.name, file.type, file.size, folderId, timestamp, timestamp).run();

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

