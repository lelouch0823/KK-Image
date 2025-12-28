import { success, error } from '../../../utils/response.js';

export async function onRequest(context) {
    const { request, params, env } = context;

    try {
        const fileId = params.id;

        // 获取元数据
        const value = await env.img_url.getWithMetadata(fileId);

        // 如果记录不存在
        if (!value || !value.metadata) {
            return error('File not found', 404);
        }

        // 从请求体或查询参数获取新文件名
        let newFileName;
        const url = new URL(request.url);

        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            newFileName = body.fileName || body.name;
        } else {
            newFileName = url.searchParams.get('name');
        }

        if (!newFileName) {
            return error('New file name is required', 400);
        }

        // 更新文件名
        const updatedMetadata = {
            ...value.metadata,
            fileName: newFileName,
            updatedAt: Date.now()
        };

        await env.img_url.put(fileId, '', { metadata: updatedMetadata });

        return success({ fileName: newFileName });

    } catch (error) {
        console.error('Error editing file name:', error);
        return error(error.message, 500);
    }
}