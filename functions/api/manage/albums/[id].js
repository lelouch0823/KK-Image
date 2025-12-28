/**
 * 单个相册操作 API
 * GET /api/manage/albums/:id - 获取相册详情
 * PUT /api/manage/albums/:id - 更新相册
 * DELETE /api/manage/albums/:id - 删除相册
 */
import { success, error } from '../../utils/response.js';

export async function onRequestGet(context) {
    const { env, params } = context;
    const albumId = params.id;

    try {
        const album = await env.img_url.get(`album:${albumId}`, { type: 'json' });

        if (!album) {
            return error('相册不存在', 404);
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

        return success({
            ...album,
            files: filesWithDetails.filter(Boolean),
            shareUrl: `/gallery/${album.shareToken}`
        });
    } catch (error) {
        return error(error.message, 500);
    }
}

export async function onRequestPut(context) {
    const { request, env, params } = context;
    const albumId = params.id;

    try {
        const album = await env.img_url.get(`album:${albumId}`, { type: 'json' });

        if (!album) {
            return error('相册不存在', 404);
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

        return success(album);
    } catch (error) {
        return error(error.message, 500);
    }
}

export async function onRequestDelete(context) {
    const { env, params } = context;
    const albumId = params.id;

    try {
        const album = await env.img_url.get(`album:${albumId}`, { type: 'json' });

        if (!album) {
            return error('相册不存在', 404);
        }

        // 删除相册数据
        await env.img_url.delete(`album:${albumId}`);

        // 更新索引
        const indexData = await env.img_url.get('albums:index', { type: 'json' });
        if (indexData) {
            indexData.albums = indexData.albums.filter(a => a.id !== albumId);
            await env.img_url.put('albums:index', JSON.stringify(indexData));
        }

        return success(null, '相册已删除');
    } catch (error) {
        return error(error.message, 500);
    }
}
