/**
 * 单个相册操作 API
 * GET /api/manage/albums/:id - 获取相册详情
 * PUT /api/manage/albums/:id - 更新相册
 * DELETE /api/manage/albums/:id - 删除相册
 */

export async function onRequestGet(context) {
    const { env, params } = context;
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

        // 获取文件详情
        const filesWithDetails = await Promise.all(
            (album.files || []).map(async (fileId) => {
                const fileData = await env.img_url.get(fileId, { type: 'json' });
                if (!fileData) return null;
                return {
                    id: fileId,
                    name: fileId,
                    metadata: fileData
                };
            })
        );

        return new Response(JSON.stringify({
            success: true,
            data: {
                ...album,
                files: filesWithDetails.filter(Boolean),
                shareUrl: `/gallery/${album.shareToken}`
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

export async function onRequestPut(context) {
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
        const { name, description, isPublic, password, coverImage } = body;

        // 更新字段
        if (name !== undefined) album.name = name.trim();
        if (description !== undefined) album.description = description.trim();
        if (isPublic !== undefined) album.isPublic = isPublic;
        if (password !== undefined) album.password = password;
        if (coverImage !== undefined) album.coverImage = coverImage;
        album.updatedAt = Date.now();

        await env.img_url.put(`album:${albumId}`, JSON.stringify(album));

        // 更新索引中的名称
        const indexData = await env.img_url.get('albums:index', { type: 'json' });
        if (indexData) {
            const albumIndex = indexData.albums.findIndex(a => a.id === albumId);
            if (albumIndex > -1 && name !== undefined) {
                indexData.albums[albumIndex].name = album.name;
                await env.img_url.put('albums:index', JSON.stringify(indexData));
            }
        }

        return new Response(JSON.stringify({
            success: true,
            data: album
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
    const { env, params } = context;
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

        // 删除相册数据
        await env.img_url.delete(`album:${albumId}`);

        // 更新索引
        const indexData = await env.img_url.get('albums:index', { type: 'json' });
        if (indexData) {
            indexData.albums = indexData.albums.filter(a => a.id !== albumId);
            await env.img_url.put('albums:index', JSON.stringify(indexData));
        }

        return new Response(JSON.stringify({
            success: true,
            message: '相册已删除'
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
