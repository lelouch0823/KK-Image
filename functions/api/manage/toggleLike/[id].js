export async function onRequest(context) {
    const { params, env } = context;

    try {
        const fileId = params.id;

        // 获取元数据
        const value = await env.img_url.getWithMetadata(fileId);

        // 如果记录不存在
        if (!value || !value.metadata) {
            return new Response(JSON.stringify({
                success: false,
                error: 'File not found'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 切换 liked 状态并更新
        const newLikedState = !value.metadata.liked;
        const updatedMetadata = {
            ...value.metadata,
            liked: newLikedState
        };

        await env.img_url.put(fileId, '', { metadata: updatedMetadata });

        return new Response(JSON.stringify({
            success: true,
            liked: newLikedState
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error toggling like:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
