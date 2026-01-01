/**
 * 数据库备份管理 API
 * GET /api/manage/backups - 列出所有备份
 * POST /api/manage/backups - 创建新备份 (Streaming SOTA)
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { verifyJWT, ADMIN_AUTH_COOKIE } from '../../utils/auth.js';
import { parse as parseCookie } from 'cookie';
import { now } from '../../utils/id.js';

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

/**
 * GET - 列出备份
 */
export async function onRequestGet(context) {
    const { env, request } = context;

    try {
        await checkAdmin(request, env);

        // 列出 R2_BACKUP_BUCKET 中的文件
        const list = await env.R2_BACKUP_BUCKET.list();

        const backups = list.objects.map(obj => ({
            name: obj.key,
            size: obj.size,
            uploadedAt: obj.uploaded,
            key: obj.key
        })).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        return success(backups);
    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED) return error(err.message, 401);
        console.error('List backups failed:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}

/**
 * POST - 创建备份
 * SOTA Strategy: 使用 TransformStream + Generator 流式处理 D1 数据导出 -> Gzip -> R2
 * 避免内存溢出，支持大规模数据库。
 */
export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        await checkAdmin(request, env);

        // 1. 获取所有表名
        const { results: tables } = await env.DB.prepare(`
            SELECT name FROM sqlite_schema 
            WHERE type ='table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_KV'
        `).all();
        const tableNames = tables.map(t => t.name);

        // 2. 创建流转换器
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // 3. 异步生成数据并写入流 (后台执行)
        // 这是一个 IIFE，不会阻塞 main thread，但 writer 保持 stream open
        (async () => {
            try {
                // 写入 metadata 和 data 开始
                const metadata = {
                    timestamp: now(),
                    createdAt: new Date().toISOString(),
                    version: '1.0'
                };
                await writer.write(encoder.encode(`{"metadata":${JSON.stringify(metadata)},"data":{`));

                for (let i = 0; i < tableNames.length; i++) {
                    const table = tableNames[i];

                    // 获取 Schema
                    const schemaRes = await env.DB.prepare(`SELECT sql FROM sqlite_schema WHERE name = ?`).bind(table).first();
                    const schema = schemaRes?.sql || '';

                    // 开始表对象
                    // 如果不是第一个表，前面加逗号
                    const prefix = i === 0 ? '"' : ',"';
                    await writer.write(encoder.encode(`${prefix}${table}":{"schema":${JSON.stringify(schema)},"rows":[ `));

                    // 分页获取数据
                    const LIMIT = 500;
                    let offset = 0;
                    let firstRowInTable = true;

                    while (true) {
                        const { results } = await env.DB.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`)
                            .bind(LIMIT, offset)
                            .all();

                        if (!results || results.length === 0) break;

                        // 转换当前块为 JSON 字符串片段 (去除 [] 两端)
                        // 这里通过 map 单独 stringify 每一行，然后 join
                        const chunkString = results.map(row => JSON.stringify(row)).join(',');

                        // 处理逗号
                        if (!firstRowInTable) {
                            await writer.write(encoder.encode(','));
                        }
                        await writer.write(encoder.encode(chunkString));

                        firstRowInTable = false;
                        offset += LIMIT;

                        // 安全检查：防止无限循环（理论上 D1 不会，但 SOTA 需要防御）
                        if (results.length < LIMIT) break;
                    }

                    // 结束表对象
                    await writer.write(encoder.encode(']}'));
                }

                // 结束 JSON
                await writer.write(encoder.encode('}}'));
                await writer.close();

            } catch (streamErr) {
                console.error('Stream processing error:', streamErr);
                await writer.abort(streamErr);
            }
        })();

        // 4. 构建压缩流管道
        const gzipStream = readable.pipeThrough(new CompressionStream('gzip'));

        // 5. 上传到 R2 (流式上传)
        const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;
        const key = filename;

        await env.R2_BACKUP_BUCKET.put(key, gzipStream, {
            httpMetadata: {
                contentType: 'application/gzip',
                contentDisposition: `attachment; filename="${filename}"`
            }
        });

        // 注意：流式上传无法立即知道大小，返回 0 或估算值
        return success({
            filename,
            key,
            size: 0,
            note: 'Backup created successfully (Streaming upload, size updated later)'
        }, MSG.COMMON.OP_SUCCESS);

    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED) return error(err.message, 401);
        console.error('Create backup failed:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
