/**
 * 公开空间访问 API
 * GET /api/space/:token - 获取公开空间 information
 */

import { success, error } from '../utils/response.js';
import { MSG } from '../utils/messages.js';

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const shareToken = params.token;

    try {
        // 查找空间
        const space = await env.DB.prepare(`
            SELECT * FROM spaces WHERE share_token = ?
        `).bind(shareToken).first();

        if (!space) {
            return error(MSG.SPACE.NOT_FOUND, 404);
        }

        // 检查是否公开
        if (!space.is_public) {
            return error(MSG.SPACE.PRIVATE, 403);
        }

        // 检查是否过期
        if (space.expires_at && space.expires_at < Date.now()) {
            return error(MSG.SPACE.EXPIRED, 410);
        }

        // 检查密码
        if (space.password) {
            const url = new URL(request.url);
            const providedPassword = url.searchParams.get('password');

            if (!providedPassword || providedPassword !== space.password) {
                return success({ requiresPassword: true }, MSG.SPACE.PASSWORD_REQUIRED, 401);
            }
        }

        // 获取文件列表
        const { results: files } = await env.DB.prepare(`
            SELECT sf.section, sf.sort_order, f.*
            FROM space_files sf
            JOIN files f ON sf.file_id = f.id
            WHERE sf.space_id = ?
            ORDER BY sf.section ASC, sf.sort_order ASC
        `).bind(space.id).all();

        // 获取子空间
        const { results: subspaces } = await env.DB.prepare(`
            SELECT id, name, template, share_token, description,
                   (SELECT COUNT(*) FROM space_files WHERE space_id = spaces.id) as file_count
            FROM spaces 
            WHERE parent_id = ? AND is_public = 1
            ORDER BY sort_order ASC, name ASC
        `).bind(space.id).all();

        // 记录访问
        const accessId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
        await env.DB.prepare(`
            INSERT INTO space_access_logs (id, space_id, ip_address, user_agent, referrer, accessed_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            accessId,
            space.id,
            request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '',
            request.headers.get('User-Agent') || '',
            request.headers.get('Referer') || '',
            Date.now()
        ).run();

        // 更新访问计数
        await env.DB.prepare('UPDATE spaces SET view_count = view_count + 1 WHERE id = ?').bind(space.id).run();

        // 判断文件类型
        const getFileType = (mimeType, name) => {
            if (mimeType?.startsWith('image/')) return 'image';
            if (mimeType === 'application/pdf') return 'pdf';
            const ext = name?.split('.').pop()?.toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image';
            if (ext === 'pdf') return 'pdf';
            return 'file';
        };

        // 按 section 分组文件
        const groupedFiles = {};
        files.forEach(f => {
            const section = f.section || 'default';
            if (!groupedFiles[section]) {
                groupedFiles[section] = [];
            }
            groupedFiles[section].push({
                id: f.id,
                name: f.original_name || f.name,
                size: f.size,
                type: getFileType(f.mime_type, f.name),
                mimeType: f.mime_type,
                url: `/file/${f.storage_key}`,
                thumbnailUrl: getFileType(f.mime_type, f.name) === 'image' ? `/file/${f.storage_key}` : null
            });
        });

        // 封面图片 - 优先使用显式设置的封面，否则回退到第一张图片
        const allFiles = Object.values(groupedFiles).flat();
        let coverImage = null;
        if (space.cover_file_id) {
            const coverFile = allFiles.find(f => f.id === space.cover_file_id);
            coverImage = coverFile?.url || null;
        }
        if (!coverImage) {
            // 回退到第一张图片
            const firstImage = allFiles.find(f => f.type === 'image');
            coverImage = firstImage?.url || null;
        }

        return success({
            name: space.name,
            description: space.description,
            template: space.template,
            templateData: space.template_data ? JSON.parse(space.template_data) : null,
            coverImage,
            coverFileId: space.cover_file_id,
            fileCount: allFiles.length,
            viewCount: space.view_count + 1,
            files: allFiles,
            groupedFiles,
            subspaces: subspaces.map(s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                template: s.template,
                fileCount: s.file_count,
                shareUrl: s.share_token ? `/space/${s.share_token}` : null
            }))
        }, 'Success', 200, {
            'Cache-Control': 'public, max-age=60'
        });
    } catch (err) {
        console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
