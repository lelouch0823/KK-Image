/**
 * 下载备份文件 API
 * GET /api/manage/backups/:filename
 */

import { error } from '../../utils/response.js'; // 不需要 success，直接返回流
import { MSG } from '../../utils/messages.js';
import { verifyJWT, ADMIN_AUTH_COOKIE } from '../../utils/auth.js';
import { parse as parseCookie } from 'cookie';

/**
 * 鉴权辅助函数
 */
async function checkAdmin(request, env) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookie(cookieHeader);
    const jwt = cookies[ADMIN_AUTH_COOKIE];

    if (!jwt) throw new Error(MSG.AUTH.REQUIRED);
    await verifyJWT(jwt, env);
}

export async function onRequestGet(context) {
    const { env, request, params } = context;
    const { filename } = params;

    try {
        await checkAdmin(request, env);

        const key = filename; // 专用 Bucket，根目录
        const object = await env.R2_BACKUP_BUCKET.get(key);

        if (!object) {
            return error('Backup file not found', 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        // 强制下载 header
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        headers.set('Content-Type', 'application/gzip');

        return new Response(object.body, {
            headers
        });

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED) return error(err.message, 401);
        console.error('Download backup error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
