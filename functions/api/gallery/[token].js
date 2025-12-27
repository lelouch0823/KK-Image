/**
 * 公开画廊 API (D1 版本)
 * GET /api/gallery/:token - 获取公开文件夹信息和文件列表
 */

import { getShareUrl, getFileUrl } from '../utils/url.js';

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const shareToken = params.token;

    try {
        // 查找匹配的文件夹
        const folder = await env.DB.prepare(`
      SELECT * FROM folders WHERE share_token = ?
    `).bind(shareToken).first();

        if (!folder) {
            return new Response(JSON.stringify({
                success: false,
                message: '文件夹不存在或链接已失效'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 检查是否公开
        if (!folder.is_public) {
            return new Response(JSON.stringify({
                success: false,
                message: '该文件夹未公开'
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 检查密码保护
        if (folder.password) {
            const url = new URL(request.url);
            const providedPassword = url.searchParams.get('password');

            if (!providedPassword || providedPassword !== folder.password) {
                return new Response(JSON.stringify({
                    success: false,
                    requiresPassword: true,
                    message: '该文件夹需要密码'
                }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // 获取文件列表
        const { results: files } = await env.DB.prepare(`
      SELECT * FROM files WHERE folder_id = ? ORDER BY created_at DESC
    `).bind(folder.id).all();

        // 获取子文件夹列表（如果也是公开的）
        const { results: subfolders } = await env.DB.prepare(`
      SELECT id, name, share_token, is_public,
             (SELECT COUNT(*) FROM files WHERE folder_id = folders.id) as file_count
      FROM folders 
      WHERE parent_id = ? AND is_public = 1
      ORDER BY name ASC
    `).bind(folder.id).all();

        // 判断文件类型
        const getFileType = (mimeType, name) => {
            if (mimeType?.startsWith('image/')) return 'image';
            if (mimeType === 'application/pdf') return 'pdf';
            const ext = name?.split('.').pop()?.toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image';
            if (ext === 'pdf') return 'pdf';
            return 'file';
        };

        // 获取封面图片（第一张图片）
        const coverFile = files.find(f => getFileType(f.mime_type, f.name) === 'image');

        return new Response(JSON.stringify({
            success: true,
            data: {
                name: folder.name,
                description: folder.description,
                coverImage: coverFile ? getFileUrl(coverFile.storage_key) : null,
                fileCount: files.length,
                createdAt: folder.created_at,
                files: files.map(f => ({
                    id: f.id,
                    name: f.original_name || f.name,
                    size: f.size,
                    type: getFileType(f.mime_type, f.name),
                    url: getFileUrl(f.storage_key),
                    thumbnailUrl: getFileType(f.mime_type, f.name) === 'image' ? getFileUrl(f.storage_key) : null,
                    createdAt: f.created_at
                })),
                subfolders: subfolders.map(sf => ({
                    id: sf.id,
                    name: sf.name,
                    fileCount: sf.file_count,
                    shareUrl: getShareUrl(sf.share_token)
                }))
            }
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60'
            }
        });
    } catch (error) {
        console.error('获取画廊失败:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
