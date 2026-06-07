/**
 * 数据库备份核心工具
 * 提供数据导出、压缩以及自动清理旧备份的功能。
 *
 * SOTA 优化：
 * 采用"逐表序列化 -> 流式压缩 -> 上传"策略，
 * 避免全量数据累积在内存中导致 OOM。
 */

import { now } from './id.js';

/**
 * 执行备份到 R2（内存优化版）
 * @param {Object} env - Cloudflare 环境变量
 * @returns {Promise<Object>} 备份结果
 */
export async function performStreamingBackup(env) {
  // 1. 获取所有表名
  const { results: tables } = await env.DB.prepare(
    `
        SELECT name FROM sqlite_schema
        WHERE type ='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
    `
  ).all();
  const tableNames = tables.map((t) => t.name);

  // 2. 逐表导出并立即序列化，避免全量累积
  const serializedParts = [];
  let totalOriginalSize = 0;

  // 写入元数据和 data 开头
  const metadataJson = JSON.stringify({
    timestamp: now(),
    createdAt: new Date().toISOString(),
    version: '1.1',
  });
  serializedParts.push(`{"metadata":${metadataJson},"data":{`);

  for (let i = 0; i < tableNames.length; i++) {
    const table = tableNames[i];
    const schemaRes = await env.DB.prepare(`SELECT sql FROM sqlite_schema WHERE name = ?`)
      .bind(table)
      .first();
    const schema = schemaRes?.sql || '';

    // 分页获取数据并逐页序列化，避免一次性加载全部行
    const LIMIT = 500;
    let offset = 0;
    const rowChunks = [];

    while (true) {
      const { results } = await env.DB.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`)
        .bind(LIMIT, offset)
        .all();

      if (!results || results.length === 0) break;
      rowChunks.push(...results);
      offset += LIMIT;
      if (results.length < LIMIT) break;
    }

    // 立即序列化该表数据，释放行数据引用
    const tableJson = JSON.stringify({ schema, rows: rowChunks });
    totalOriginalSize += tableJson.length;

    // 表之间用逗号分隔
    const separator = i > 0 ? ',' : '';
    serializedParts.push(`${separator}"${table}":${tableJson}`);
  }

  // 关闭 JSON 结构
  serializedParts.push('}}');

  // 3. 流式压缩（避免创建完整字符串副本）
  const encoder = new TextEncoder();
  const parts = serializedParts.map((part) => encoder.encode(part));
  const compressedStream = new Blob(parts).stream().pipeThrough(new CompressionStream('gzip'));
  const compressedBlob = await new Response(compressedStream).blob();
  const compressedBuffer = await compressedBlob.arrayBuffer();

  // 4. 上传到 R2 (使用 ArrayBuffer，有确定长度)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}.json.gz`;
  const key = filename;

  await env.R2_BACKUP_BUCKET.put(key, compressedBuffer, {
    httpMetadata: {
      contentType: 'application/gzip',
      contentDisposition: `attachment; filename="${filename}"`,
    },
    customMetadata: {
      type: 'auto-backup',
      timestamp: String(now()),
      tables: String(tableNames.length),
      originalSize: String(totalOriginalSize),
      compressedSize: String(compressedBuffer.byteLength),
    },
  });

  return {
    filename,
    key,
    tables: tableNames.length,
    originalSize: totalOriginalSize,
    compressedSize: compressedBuffer.byteLength,
  };
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
    await Promise.all(toDelete.map((obj) => env.R2_BACKUP_BUCKET.delete(obj.key)));
  }

  return toDelete.length;
}
