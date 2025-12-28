/**
 * @fileoverview 文件上传处理
 * @module upload
 * 
 * 支持多种存储模式：
 * - single: 单一存储
 * - smart: 智能路由（根据规则选择）
 * - redundant: 冗余存储（多存储同步）
 */

import { errorHandling, telemetryData } from "./utils/middleware";
import { triggerWebhook } from "./api/utils/webhook.js";
import { RedundancyManager } from "./storage/redundancy.js";
import { getFileUrl } from "./api/utils/url.js";
import { getUser } from "./api/utils/context.js";
import { success } from "./api/utils/response.js";

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const clonedRequest = request.clone();
        const formData = await clonedRequest.formData();

        await errorHandling(context);
        telemetryData(context);

        const uploadFile = formData.get('file');
        if (!uploadFile) {
            throw new Error('No file uploaded');
        }

        const fileName = uploadFile.name;
        const user = getUser(context);

        // 使用冗余管理器处理上传 (R2/S3/Telegram)
        const redundancyManager = new RedundancyManager(env, context);
        const result = await redundancyManager.upload(uploadFile, {
            fileName: fileName,
            contentType: uploadFile.type
        });

        if (!result.success) {
            throw new Error(result.error);
        }

        const fileId = result.fileId;
        const now = Date.now();

        // 将文件元数据保存到 D1 数据库 (替代 KV)
        if (env.DB) {
            await env.DB.prepare(`
                INSERT INTO files (id, folder_id, name, original_name, size, mime_type, storage_key, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                fileId,
                null, // 默认不属于任何文件夹
                fileName,
                fileName,
                uploadFile.size,
                uploadFile.type,
                fileId, // storage_key 与 fileId 相同
                now
            ).run();
        }

        // 构建文件信息用于 Webhook
        const fileInfo = {
            id: fileId,
            filename: fileName,
            size: uploadFile.size,
            type: uploadFile.type,
            uploadTime: new Date().toISOString(),
            url: getFileUrl(fileId, new URL(request.url).origin),
            uploader: user.name || user.id,
            storage: result.metadata?.storage
        };

        // 触发 Webhook 事件
        try {
            await triggerWebhook(env, 'file.uploaded', {
                file: fileInfo,
                user: user
            });
        } catch (webhookError) {
            console.error('Webhook trigger failed:', webhookError);
        }

        // 使用统一的 success 响应格式
        return success([{ src: `/file/${fileId}` }]);
    } catch (error) {
        console.error('Upload error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}