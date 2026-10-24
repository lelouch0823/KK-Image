/**
 * Blob (CAS) 工具函数
 * 用于管理 Content-Addressable Storage 的引用计数和去重
 */

import { now } from './id.js';

/**
 * 检查 blob 是否存在
 * @param {Object} env - Cloudflare 环境
 * @param {string} hash - SHA-256 哈希
 * @returns {Promise<Object|null>} blob 信息或 null
 */
export async function getBlobByHash(env, hash) {
  if (!hash) return null;
  return await env.DB.prepare(
    'SELECT content_hash, size, mime_type, ref_count FROM blobs WHERE content_hash = ?'
  )
    .bind(hash)
    .first();
}

/**
 * 创建新的 blob 记录
 * @param {Object} env - Cloudflare 环境
 * @param {string} hash - SHA-256 哈希
 * @param {number} size - 文件大小
 * @param {string} mimeType - MIME 类型
 */
export async function createBlob(env, hash, size, mimeType) {
  const timestamp = now();
  await env.DB.prepare(
    `
        INSERT INTO blobs (content_hash, size, mime_type, ref_count, created_at)
        VALUES (?, ?, ?, 1, ?)
    `
  )
    .bind(hash, size, mimeType, timestamp)
    .run();
}

/**
 * 增加 blob 引用计数。
 *
 * @param {Object} env - Cloudflare 环境
 * @param {string} hash - SHA-256 哈希
 * @returns {Promise<boolean>} 是否成功认领（blob 行仍存在）。false 表示
 *   行已被并发清理删除——调用方必须放弃秒传、走完整上传兜底，否则新建的
 *   files 记录会指向已删除的 R2 对象（静默丢数据，审查 B4）
 */
export async function incrementRefCount(env, hash) {
  const result = await env.DB.prepare(
    'UPDATE blobs SET ref_count = ref_count + 1 WHERE content_hash = ?'
  )
    .bind(hash)
    .run();
  return Number(result?.meta?.changes || 0) === 1;
}

/**
 * 减少 blob 引用计数，如果为 0 则删除 R2 对象
 *
 * SOTA（审查 B4）：认领式删除。旧实现"观察到 ref_count<=0 后无条件删 R2、
 * 再条件删行"存在两个交错窗口：
 *  1. SELECT 与 R2 删除之间并发秒传 increment（0→1）：行被复活但 R2 对象
 *     已删，新文件记录指向已删除对象；
 *  2. R2 删除与行删除之间并发 increment：UPDATE 0 行被忽略，同上。
 * 现改为先以条件 DELETE 认领（changes()=1 才获得删除权，认领失败=有人
 * 并发复活，直接跳过对象删除），认领成功后再删 R2——此时行已不存在，
 * 任何并发的 increment 都会命中 0 行并触发完整上传兜底，闭环无竞态。
 * R2 删除失败时以 ref_count=0 重建墓碑行（INSERT OR IGNORE）保留重试
 * 入口并向上抛出；墓碑行同时可被并发秒传直接认领复用。
 *
 * @param {Object} env - Cloudflare 环境
 * @param {string} hash - SHA-256 哈希
 * @returns {Promise<boolean>} 是否删除了 R2 对象
 */
export async function decrementRefCount(env, hash) {
  if (!hash) return false;

  // 原子减少引用计数
  const updateStmt = env.DB.prepare(
    'UPDATE blobs SET ref_count = ref_count - 1 WHERE content_hash = ?'
  ).bind(hash);

  // 查询更新后的引用计数（含 size/mime：R2 删除失败时据此重建墓碑行）
  const selectStmt = env.DB.prepare(
    'SELECT ref_count, size, mime_type FROM blobs WHERE content_hash = ?'
  ).bind(hash);

  // 使用 batch 保证原子性
  const [, selectResult] = await env.DB.batch([updateStmt, selectStmt]);
  const blob = selectResult.results?.[0];

  // 如果不存在（可能已被其他请求删除），直接返回
  if (!blob) return false;

  if (blob.ref_count <= 0) {
    // 认领删除权：条件 DELETE 只在引用仍为 0 时命中；并发秒传复活行时
    // changes()=0，跳过对象删除（该 blob 已被新引用接管）
    const claimResult = await env.DB.prepare(
      'DELETE FROM blobs WHERE content_hash = ? AND ref_count <= 0'
    )
      .bind(hash)
      .run();
    if (Number(claimResult?.meta?.changes || 0) !== 1) {
      return false;
    }

    // 认领成功：行已不存在，并发的 increment 会命中 0 行并走完整上传，
    // 此处删除 R2 对象不再有竞态窗口。删除失败时以 ref_count=0 重建
    // 墓碑行（INSERT OR IGNORE——若并发秒传已重建台账则不打扰）保留
    // 可重试的清理入口，然后向上抛出
    if (env.R2_BUCKET) {
      try {
        await env.R2_BUCKET.delete(hash);
      } catch (err) {
        const timestamp = now();
        await env.DB.prepare(
          `INSERT OR IGNORE INTO blobs (content_hash, size, mime_type, ref_count, created_at)
           VALUES (?, ?, ?, 0, ?)`
        )
          .bind(hash, blob.size ?? 0, blob.mime_type ?? null, timestamp)
          .run();
        throw err;
      }
    }
    return true;
  }

  return false;
}

/**
 * 创建文件引用（虚拟目录条目）
 * @param {Object} env - Cloudflare 环境
 * @param {Object} options - 文件选项
 * @param {string} options.id - 文件 ID
 * @param {string} options.hash - 内容哈希
 * @param {string} options.name - 文件名
 * @param {string} options.folderId - 文件夹 ID
 * @param {string} options.mimeType - MIME 类型
 * @param {number} options.size - 文件大小
 */
export async function createFileReference(env, options) {
  const { id, hash, name, folderId, mimeType, size } = options;
  const timestamp = now();

  await env.DB.prepare(
    `
        INSERT INTO files (id, name, storage_key, original_name, mime_type, size, folder_id, content_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
    .bind(id, name, hash, name, mimeType, size, folderId, hash, timestamp, timestamp)
    .run();
}

/**
 * 上传到 R2 并创建 blob 记录
 * @param {Object} env - Cloudflare 环境
 * @param {string} hash - 内容哈希（作为 R2 key）
 * @param {ReadableStream} stream - 文件流
 * @param {string} mimeType - MIME 类型
 * @param {number} size - 文件大小
 */
export async function uploadToBlobStorage(env, hash, stream, mimeType, size) {
  // 上传到 R2，使用哈希作为 key
  await env.R2_BUCKET.put(hash, stream, {
    httpMetadata: { contentType: mimeType },
  });

  // 创建 blob 记录
  await createBlob(env, hash, size, mimeType);
}
