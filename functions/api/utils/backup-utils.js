/**
 * 数据库备份核心工具
 * 提供流式数据导出、压缩以及自动清理旧备份的功能。
 */

import { now } from './id.js';

/**
 * 执行流式备份到 R2
 * @param {Object} env - Cloudflare 环境变量
 * @returns {Promise<Object>} 备份结果
 */
export async function performStreamingBackup(env) {
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

    // 3. 异步生成数据并写入流
    (async () => {
        try {
            const metadata = {
                timestamp: now(),
                createdAt: new Date().toISOString(),
                version: '1.1'
            };
            await writer.write(encoder.encode(`{"metadata":${JSON.stringify(metadata)},"data":{`));

            for (let i = 0; i < tableNames.length; i++) {
                const table = tableNames[i];
                const schemaRes = await env.DB.prepare(`SELECT sql FROM sqlite_schema WHERE name = ?`).bind(table).first();
                const schema = schemaRes?.sql || '';

                const prefix = i === 0 ? '"' : ',"';
                await writer.write(encoder.encode(`${prefix}${table}":{"schema":${JSON.stringify(schema)},"rows":[ `));

                const LIMIT = 500;
                let offset = 0;
                let firstRowInTable = true;

                while (true) {
                    const { results } = await env.DB.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`)
                        .bind(LIMIT, offset)
                        .all();

                    if (!results || results.length === 0) break;

                    const chunkString = results.map(row => JSON.stringify(row)).join(',');
                    if (!firstRowInTable) {
                        await writer.write(encoder.encode(','));
                    }
                    await writer.write(encoder.encode(chunkString));

                    firstRowInTable = false;
                    offset += LIMIT;
                    if (results.length < LIMIT) break;
                }
                await writer.write(encoder.encode(']}'));
            }

            await writer.write(encoder.encode('}}'));
            await writer.close();
        } catch (streamErr) {
            console.error('Stream processing error:', streamErr);
            await writer.abort(streamErr);
        }
    })();

    // 4. 构建压缩流管道
    const gzipStream = readable.pipeThrough(new CompressionStream('gzip'));

    // 5. 上传到 R2
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.json.gz`;
    const key = filename;

    await env.R2_BACKUP_BUCKET.put(key, gzipStream, {
        httpMetadata: {
            contentType: 'application/gzip',
            contentDisposition: `attachment; filename="${filename}"`
        },
        customMetadata: {
            type: 'auto-backup',
            timestamp: String(now())
        }
    });

    return { filename, key };
}

/**
 * 自动清理旧备份（保留最近 N 个）
 * @param {Object} env - 环境
 * @param {number} keepCount - 保留数量
 */
export async function cleanupOldBackups(env, keepCount = 7) {
    const list = await env.R2_BACKUP_BUCKET.list();
    if (list.objects.length <= keepCount) return 0;

    // 按上传时间排序 (由旧到新)
    const sorted = list.objects.sort((a, b) => new Date(a.uploaded) - new Date(b.uploaded));
    const toDelete = sorted.slice(0, sorted.length - keepCount);

    if (toDelete.length > 0) {
        await Promise.all(toDelete.map(obj => env.R2_BACKUP_BUCKET.delete(obj.key)));
    }

    return toDelete.length;
}
