/**
 * 相册列表与创建 API
 * GET /api/manage/albums - 获取所有相册
 * POST /api/manage/albums - 创建新相册
 */

import { generateId, generateShareToken } from '../../utils/id.js';
import { jsonResponse, success, error } from '../../utils/response.js';

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

        return success(albumsWithDetails.filter(Boolean));
    } catch (error) {
        return error(error.message, 500);
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { name, description = '', isPublic = false, password = null } = body;

        if (!name || name.trim() === '') {
            return error('相册名称不能为空', 400);
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

        return jsonResponse({
            success: true,
            data: {
                id: album.id,
                name: album.name,
                description: album.description,
                shareToken: album.shareToken,
                shareUrl: `/gallery/${album.shareToken}`,
                createdAt: album.createdAt
            }
        }, 201);
    } catch (error) {
        return error(error.message, 500);
    }
}
