/**
 * 相册列表与创建 API
 * GET /api/manage/albums - 获取所有相册
 * POST /api/manage/albums - 创建新相册
 */

// 生成唯一 ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// 生成分享令牌
function generateShareToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

export async function onRequestGet(context) {
    const { env } = context;

    try {
        // 获取相册索引
        const indexData = await env.img_url.get('albums:index', { type: 'json' });
        const albums = indexData?.albums || [];

        // 为每个相册获取详细信息
        const albumsWithDetails = await Promise.all(
            albums.map(async (albumMeta) => {
                const albumData = await env.img_url.get(`album:${albumMeta.id}`, { type: 'json' });
                return albumData ? {
                    id: albumData.id,
                    name: albumData.name,
                    description: albumData.description,
                    coverImage: albumData.coverImage,
                    fileCount: albumData.files?.length || 0,
                    isPublic: albumData.isPublic,
                    shareToken: albumData.shareToken,
                    createdAt: albumData.createdAt,
                    updatedAt: albumData.updatedAt
                } : null;
            })
        );

        return new Response(JSON.stringify({
            success: true,
            data: albumsWithDetails.filter(Boolean)
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

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { name, description = '', isPublic = false, password = null } = body;

        if (!name || name.trim() === '') {
            return new Response(JSON.stringify({
                success: false,
                message: '相册名称不能为空'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const albumId = generateId();
        const shareToken = generateShareToken();
        const now = Date.now();

        const album = {
            id: albumId,
            name: name.trim(),
            description: description.trim(),
            coverImage: null,
            files: [],
            isPublic,
            shareToken,
            password,
            createdAt: now,
            updatedAt: now
        };

        // 保存相册数据
        await env.img_url.put(`album:${albumId}`, JSON.stringify(album));

        // 更新索引
        const indexData = await env.img_url.get('albums:index', { type: 'json' }) || { albums: [] };
        indexData.albums.push({
            id: albumId,
            name: album.name,
            createdAt: now
        });
        await env.img_url.put('albums:index', JSON.stringify(indexData));

        return new Response(JSON.stringify({
            success: true,
            data: {
                id: album.id,
                name: album.name,
                description: album.description,
                shareToken: album.shareToken,
                shareUrl: `/gallery/${album.shareToken}`,
                createdAt: album.createdAt
            }
        }), {
            status: 201,
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
