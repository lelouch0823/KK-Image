/**
 * 数据库备份核心工具
 * 提供数据导出、压缩以及自动清理旧备份的功能。
 *
 * SOTA 优化：
 * 采用"逐表序列化 -> 流式压缩 -> 上传"策略，
 * 避免全量数据累积在内存中导致 OOM。
 */

import { now } from './id.js';

const BACKUP_PAGE_LIMIT = 500;

function quoteSqlIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function* createBackupJsonChunks(env, tableNames, metadataJson) {
  yield `{"metadata":${metadataJson},"data":{`;

  for (let i = 0; i < tableNames.length; i += 1) {
    const table = tableNames[i];
    const schemaRes = await env.DB.prepare(`SELECT sql FROM sqlite_schema WHERE name = ?`)
      .bind(table)
      .first();
    const schema = schemaRes?.sql || '';
    const tablePrefix = `${i > 0 ? ',' : ''}${JSON.stringify(table)}:{"schema":${JSON.stringify(
      schema
    )},"rows":[`;
    yield tablePrefix;

    let offset = 0;
    let hasRows = false;
    const quotedTable = quoteSqlIdentifier(table);

    while (true) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM ${quotedTable} LIMIT ? OFFSET ?`
      )
        .bind(BACKUP_PAGE_LIMIT, offset)
        .all();

      if (!results || results.length === 0) break;

      for (const row of results) {
        yield `${hasRows ? ',' : ''}${JSON.stringify(row)}`;
        hasRows = true;
      }

      offset += BACKUP_PAGE_LIMIT;
      if (results.length < BACKUP_PAGE_LIMIT) break;
    }

    yield ']}';
  }

  yield '}}';
}

function createEncodedTextStream(chunks, onBytes) {
  const encoder = new TextEncoder();
  const iterator = chunks[Symbol.asyncIterator]();

  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }

      const encoded = encoder.encode(value);
      onBytes(encoded.byteLength);
      controller.enqueue(encoded);
    },
    async cancel(reason) {
      if (typeof iterator.return === 'function') {
        await iterator.return(reason);
      }
    },
  });
}

function createByteCounter(onBytes) {
  return new TransformStream({
    transform(chunk, controller) {
      onBytes(chunk?.byteLength ?? chunk?.length ?? 0);
      controller.enqueue(chunk);
    },
  });
}

/**
 * 执行备份到 R2（内存优化版）
 * @param {Object} env - Cloudflare 环境变量
 * @returns {Promise<Object>} 备份结果
 */
export async function performStreamingBackup(env) {
  const { results: tables } = await env.DB.prepare(
    `
        SELECT name FROM sqlite_schema
        WHERE type ='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
    `
  ).all();
  const tableNames = (tables || []).map((t) => t.name);

  const metadataJson = JSON.stringify({
    timestamp: now(),
    createdAt: new Date().toISOString(),
    version: '1.1',
  });

  let totalOriginalSize = 0;
  let totalCompressedSize = 0;
  const sourceStream = createEncodedTextStream(
    createBackupJsonChunks(env, tableNames, metadataJson),
    (bytes) => {
      totalOriginalSize += bytes;
    }
  );
  const compressedStream = sourceStream
    .pipeThrough(new CompressionStream('gzip'))
    .pipeThrough(
      createByteCounter((bytes) => {
        totalCompressedSize += bytes;
      })
    );

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}.json.gz`;
  const key = filename;

  await env.R2_BACKUP_BUCKET.put(key, compressedStream, {
    httpMetadata: {
      contentType: 'application/gzip',
      contentDisposition: `attachment; filename="${filename}"`,
    },
    customMetadata: {
      type: 'auto-backup',
      timestamp: String(now()),
      tables: String(tableNames.length),
      originalSize: 'streamed',
      compressedSize: 'streamed',
    },
  });

  return {
    filename,
    key,
    tables: tableNames.length,
    originalSize: totalOriginalSize,
    compressedSize: totalCompressedSize,
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
