import { triggerWebhook } from '../../utils/webhook.js';

export async function onRequest(context) {
    // Contents of context object
    const {
      request, // same as existing Worker API
      env, // same as existing Worker API
      params, // if filename includes [id] or [[path]]
      waitUntil, // same as ctx.waitUntil in existing Worker API
      next, // used for middleware or to fetch assets
      data, // arbitrary space for passing data between middlewares
    } = context;

    try {
        const fileId = params.id;
        console.log('Deleting file:', fileId);

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

        return new Response(JSON.stringify({
            success: true,
            message: 'File deleted successfully',
            fileId: fileId
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error deleting file:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}