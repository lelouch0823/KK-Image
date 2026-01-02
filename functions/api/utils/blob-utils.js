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
 * 增加 blob 引用计数
 * @param {Object} env - Cloudflare 环境
 * @param {string} hash - SHA-256 哈希
 */
export async function incrementRefCount(env, hash) {
  await env.DB.prepare('UPDATE blobs SET ref_count = ref_count + 1 WHERE content_hash = ?')
    .bind(hash)
    .run();
}

/**
 * 减少 blob 引用计数，如果为 0 则删除 R2 对象
 * @param {Object} env - Cloudflare 环境
 * @param {string} hash - SHA-256 哈希
 * @returns {Promise<boolean>} 是否删除了 R2 对象
 */
export async function decrementRefCount(env, hash) {
  if (!hash) return false;

  // 先检查当前引用计数
  const blob = await env.DB.prepare('SELECT ref_count FROM blobs WHERE content_hash = ?')
    .bind(hash)
    .first();

  if (!blob) return false;

  if (blob.ref_count <= 1) {
    // 最后一个引用，删除 blob 和 R2 对象
    await env.DB.prepare('DELETE FROM blobs WHERE content_hash = ?').bind(hash).run();

    // 删除 R2 对象
    if (env.R2_BUCKET) {
      try {
        await env.R2_BUCKET.delete(hash);
      } catch (e) {
        console.error('Failed to delete R2 object:', hash, e);
      }
    }
    return true;
  } else {
    // 减少引用计数
    await env.DB.prepare('UPDATE blobs SET ref_count = ref_count - 1 WHERE content_hash = ?')
      .bind(hash)
      .run();
    return false;
  }
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
