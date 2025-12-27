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

        // 使用冗余管理器处理上传
        const redundancyManager = new RedundancyManager(env, context);
        const result = await redundancyManager.upload(uploadFile, {
            fileName: fileName,
            contentType: uploadFile.type
        });

        if (!result.success) {
            throw new Error(result.error);
        }

        const fileId = result.fileId;

        // 将文件信息保存到 KV 存储
        if (env.img_url) {
            const metadata = {
                TimeStamp: Date.now(),
                ListType: "None",
                Label: "None",
                liked: false,
                fileName: fileName,
                fileSize: uploadFile.size,
                // 存储信息（包含主存储和镜像信息）
                storage: result.metadata?.storage || {
                    primary: result.metadata?.storageProvider || 'telegram',
                    primaryId: result.metadata?.storageId || fileId
                }
            };

            await env.img_url.put(fileId, "", { metadata });
        }

        // 构建文件信息用于 Webhook
        const fileInfo = {
            id: fileId,
            filename: fileName,
            size: uploadFile.size,
            type: uploadFile.type,
            uploadTime: new Date().toISOString(),
            status: 'normal',
            url: getFileUrl(fileId, new URL(request.url).origin),
            uploader: 'anonymous',
            storage: result.metadata?.storage
        };

        // 触发 Webhook 事件
        try {
            await triggerWebhook(env, 'file.uploaded', {
                file: fileInfo,
                user: { id: 'anonymous', name: 'anonymous' }
            });
        } catch (webhookError) {
            console.error('Webhook trigger failed:', webhookError);
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