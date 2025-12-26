/**
 * 相册文件管理 API
 * POST /api/manage/albums/:id/files - 添加文件到相册
 * DELETE /api/manage/albums/:id/files - 从相册移除文件
 */

export async function onRequestPost(context) {
    const { request, env, params } = context;
    const albumId = params.id;

    try {
        const album = await env.img_url.get(`album:${albumId}`, { type: 'json' });

        if (!album) {
            return new Response(JSON.stringify({
                success: false,
                message: '相册不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await request.json();
        const { fileIds } = body;

        if (!Array.isArray(fileIds) || fileIds.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: '请提供要添加的文件 ID'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证文件存在性并添加
        const validFileIds = [];
        for (const fileId of fileIds) {
            const fileData = await env.img_url.get(fileId, { type: 'json' });
            if (fileData && !album.files.includes(fileId)) {
                validFileIds.push(fileId);
            }
        }

        album.files = [...album.files, ...validFileIds];

        // 如果没有封面，设置第一个图片为封面
        if (!album.coverImage && validFileIds.length > 0) {
            album.coverImage = validFileIds[0];
        }

        album.updatedAt = Date.now();
        await env.img_url.put(`album:${albumId}`, JSON.stringify(album));

        return new Response(JSON.stringify({
            success: true,
            data: {
                addedCount: validFileIds.length,
                totalFiles: album.files.length
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const albumId = params.id;

    try {
        const album = await env.img_url.get(`album:${albumId}`, { type: 'json' });

        if (!album) {
            return new Response(JSON.stringify({
                success: false,
                message: '相册不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await request.json();
        const { fileIds } = body;

        if (!Array.isArray(fileIds) || fileIds.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: '请提供要移除的文件 ID'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 移除文件
        const removedCount = album.files.length;
        album.files = album.files.filter(id => !fileIds.includes(id));

        // 如果封面被移除，清空封面
        if (album.coverImage && fileIds.includes(album.coverImage)) {
            album.coverImage = album.files[0] || null;
        }

        album.updatedAt = Date.now();
        await env.img_url.put(`album:${albumId}`, JSON.stringify(album));

        return new Response(JSON.stringify({
            success: true,
            data: {
                removedCount: removedCount - album.files.length,
                totalFiles: album.files.length
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
