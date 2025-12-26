/**
 * @fileoverview 文件上传处理
 * @module upload
 * 
 * 支持多存储后端：Telegram、Cloudflare R2、S3 兼容服务
 */

import { errorHandling, telemetryData } from "./utils/middleware";
import { triggerWebhook } from "./api/utils/webhook.js";
import { getStorageProvider } from "./storage/index.js";

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

        // 获取存储提供者
        const storageProvider = getStorageProvider(env);

        // 使用存储提供者上传文件
        const result = await storageProvider.upload(uploadFile, {
            fileName: fileName,
            contentType: uploadFile.type
        });

        if (!result.success) {
            throw new Error(result.error);
        }

        const fileId = result.fileId;

        // 将文件信息保存到 KV 存储
        if (env.img_url) {
            await env.img_url.put(fileId, "", {
                metadata: {
                    TimeStamp: Date.now(),
                    ListType: "None",
                    Label: "None",
                    liked: false,
                    fileName: fileName,
                    fileSize: uploadFile.size,
                    // 新增：记录存储提供者信息
                    storageProvider: storageProvider.name,
                    storageId: result.metadata?.storageId || fileId
                }
            });
        }

        // 构建文件信息用于 Webhook
        const fileInfo = {
            id: fileId,
            filename: fileName,
            size: uploadFile.size,
            type: uploadFile.type,
            uploadTime: new Date().toISOString(),
            status: 'normal',
            url: `${new URL(request.url).origin}/file/${fileId}`,
            uploader: 'anonymous',
            storageProvider: storageProvider.name
        };

        // 触发 Webhook 事件
        try {
            await triggerWebhook(env, 'file.uploaded', {
                file: fileInfo,
                user: { id: 'anonymous', name: 'anonymous' }
            });
        } catch (webhookError) {
            console.error('Webhook trigger failed:', webhookError);
            // 不影响主要功能
        }

        return new Response(
            JSON.stringify([{ 'src': `/file/${fileId}` }]),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
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