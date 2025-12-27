/**
 * @fileoverview 文件访问处理
 * @module file/[id]
 * 
 * 基于 D1 数据库的文件服务：
 * - 从 D1 查询文件信息
 * - 直接从 R2 获取文件
 * - 设置适当的缓存控制头
 */

export async function onRequest(context) {
    const { request, env, params } = context;
    const fileId = params.id;

    // 从 D1 数据库查询文件信息
    let fileRecord = null;
    if (env.DB) {
        try {
            fileRecord = await env.DB.prepare(
                'SELECT * FROM files WHERE storage_key = ? OR id = ?'
            ).bind(fileId, fileId).first();
        } catch (err) {
            console.error('D1 query error:', err);
            return new Response('Database error', { status: 500 });
        }
    }

    // 确定要查找的 key
    const storageKey = fileRecord?.storage_key || fileId;

    // 从 R2 获取文件
    if (!env.R2_BUCKET) {
        return new Response('R2 not configured', { status: 500 });
    }

    try {
        // 使用条件请求和 Range 支持
        const object = await env.R2_BUCKET.get(storageKey, {
            onlyIf: request.headers,
            range: request.headers
        });

        if (object === null) {
            // 如果没有找到，尝试用原始 fileId
            if (storageKey !== fileId) {
                const object2 = await env.R2_BUCKET.get(fileId);
                if (object2) {
                    return buildResponse(object2, fileRecord);
                }
            }
            return new Response('File not found', { status: 404 });
        }

        return buildResponse(object, fileRecord);
    } catch (err) {
        console.error('R2 error:', err);
        return new Response('Storage error', { status: 500 });
    }
}

/**
 * 构建响应，设置适当的头
 */
function buildResponse(object, fileRecord) {
    const headers = new Headers();

    // 使用 R2 的 writeHttpMetadata 写入响应头
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    // 设置 Content-Type（优先使用数据库记录的 MIME 类型）
    if (fileRecord?.mime_type && !headers.has('Content-Type')) {
        headers.set('Content-Type', fileRecord.mime_type);
    }

    // 🚀 缓存优化：设置长期缓存 + 不可变
    if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    // 条件请求：如果没有 body，返回 304
    if (!('body' in object)) {
        return new Response(null, { status: 304, headers });
    }

    // Range 请求返回 206
    const status = object.range ? 206 : 200;

    return new Response(object.body, { status, headers });
}