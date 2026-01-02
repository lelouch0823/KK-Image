/**
 * 数据库备份核心工具
 * 提供数据导出、压缩以及自动清理旧备份的功能。
 *
 * SOTA 说明：
 * 本地 Wrangler 不支持未知长度的流式上传到 R2。
 * 因此采用"先收集全部数据 -> 压缩 -> 上传"的策略，
 * 兼容本地开发和生产环境。
 */

import { now } from './id.js';

/**
 * 执行备份到 R2
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

  // 2. 构建完整的备份对象
  const backup = {
    metadata: {
      timestamp: now(),
      createdAt: new Date().toISOString(),
      version: '1.1',
    },
    data: {},
  };

  // 3. 逐表导出数据
  for (const table of tableNames) {
    const schemaRes = await env.DB.prepare(`SELECT sql FROM sqlite_schema WHERE name = ?`)
      .bind(table)
      .first();
    const schema = schemaRes?.sql || '';

    // 分页获取所有数据
    const allRows = [];
    const LIMIT = 500;
    let offset = 0;

    while (true) {
      const { results } = await env.DB.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`)
        .bind(LIMIT, offset)
        .all();

      if (!results || results.length === 0) break;
      allRows.push(...results);
      offset += LIMIT;
      if (results.length < LIMIT) break;
    }

    backup.data[table] = {
      schema,
      rows: allRows,
    };
  }

  // 4. 序列化并压缩
  const jsonString = JSON.stringify(backup);
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(jsonString);

  // 使用 CompressionStream 压缩
  const compressedStream = new Blob([jsonBytes])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  const compressedBlob = await new Response(compressedStream).blob();
  const compressedBuffer = await compressedBlob.arrayBuffer();

  // 5. 上传到 R2 (使用 ArrayBuffer，有确定长度)
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
      originalSize: String(jsonBytes.length),
      compressedSize: String(compressedBuffer.byteLength),
    },
  });

  return {
    filename,
    key,
    tables: tableNames.length,
    originalSize: jsonBytes.length,
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
