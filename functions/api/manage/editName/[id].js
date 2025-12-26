export async function onRequest(context) {
    const { request, params, env } = context;

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
            return new Response(JSON.stringify({
                success: false,
                error: 'New file name is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 更新文件名
        const updatedMetadata = {
            ...value.metadata,
            fileName: newFileName,
            updatedAt: Date.now()
        };

        await env.img_url.put(fileId, '', { metadata: updatedMetadata });

        return new Response(JSON.stringify({
            success: true,
            fileName: newFileName
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error editing file name:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}