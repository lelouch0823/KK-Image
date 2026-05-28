/**
 * D1 批量操作封装
 * 提供事务性批量插入、更新、删除操作
 */

const D1_MAX_BATCH_SIZE = 100;

export function chunkArray(items = [], chunkSize = D1_MAX_BATCH_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const size = Math.max(1, Math.floor(chunkSize));

  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * 分块执行批量语句
 * @param {D1Database} db - D1 数据库实例
 * @param {D1PreparedStatement[]} statements - 预编译语句数组
 */
export async function executeBatchChunks(db, statements = [], chunkSize = D1_MAX_BATCH_SIZE) {
  const results = [];

  for (const chunk of chunkArray(statements, chunkSize)) {
    const chunkResults = await db.batch(chunk);
    if (Array.isArray(chunkResults)) {
      results.push(...chunkResults);
    }
  }

  return results;
}
