import { success, error } from '../../../utils/response.js';

export async function onRequest(context) {
    const { params, env } = context;

    try {
        const fileId = params.id;

        // 获取元数据
        const value = await env.img_url.getWithMetadata(fileId);

        // 如果记录不存在
        if (!value || !value.metadata) {
            return error('File not found', 404);
        }

        // 切换 liked 状态并更新
        const newLikedState = !value.metadata.liked;
        const updatedMetadata = {
            ...value.metadata,
            liked: newLikedState
        };

        await env.img_url.put(fileId, '', { metadata: updatedMetadata });

        return success({ liked: newLikedState });

    } catch (error) {
        console.error('Error toggling like:', error);
        return error(error.message, 500);
    }
}
