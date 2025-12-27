import { triggerWebhook } from '../../utils/webhook.js';
import { success, error } from '../../utils/response.js';

// 支持 GET 和 DELETE 方法（向后兼容）
export async function onRequest(context) {
    const { request, env, params } = context;

    try {
        const fileId = params.id;

        // 获取文件信息（在删除前）
        let fileInfo = null;
        try {
            const fileData = await env.img_url.get(fileId, { type: 'json' });
            if (fileData && fileData.metadata) {
                fileInfo = {
                    id: fileId,
                    filename: fileData.metadata.fileName || fileId,
                    size: fileData.metadata.fileSize || 0,
                    uploadTime: fileData.metadata.TimeStamp ? new Date(fileData.metadata.TimeStamp).toISOString() : null,
                    url: `${new URL(request.url).origin}/file/${fileId}`
                };
            }
        } catch (error) {
            console.warn('Could not retrieve file metadata before deletion:', error);
        }

        // 删除文件
        await env.img_url.delete(fileId);

        // 触发 Webhook 事件
        if (fileInfo) {
            try {
                await triggerWebhook(env, 'file.deleted', {
                    file: fileInfo,
                    deletedBy: 'admin', // 从管理界面删除
                    deletedAt: new Date().toISOString()
                });
            } catch (webhookError) {
                console.error('Webhook trigger failed:', webhookError);
                // 不影响删除操作
            }
        }

        return success({ fileId: fileId }, 'File deleted successfully');

    } catch (error) {
        console.error('Error deleting file:', error);
        return error(error.message, 500);
    }
}