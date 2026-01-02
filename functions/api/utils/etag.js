/**
 * ETag 工具模块
 * 用于生成 API 响应的 ETag，支持条件请求
 *
 * @module api/utils/etag
 */

import { sha256Hex } from './id.js';

/**
 * 计算内容的 SHA-256 哈希值（截取前 16 字符）
 * @param {string} content - 要哈希的内容
 * @returns {Promise<string>} 短哈希值
 */
export async function generateETag(content) {
  const hashHex = await sha256Hex(content);
  // 使用前 16 字符作为 ETag，足够避免碰撞
  return `"${hashHex.substring(0, 16)}"`;
}

/**
 * 检查请求的 If-None-Match 是否匹配 ETag
 * @param {Request} request - HTTP 请求
 * @param {string} etag - 当前资源的 ETag
 * @returns {boolean} 是否匹配
 */
export function matchesETag(request, etag) {
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (!ifNoneMatch) return false;

  // 支持多个 ETag（逗号分隔）
  const tags = ifNoneMatch.split(',').map((t) => t.trim());
  return tags.some((t) => t === etag || t === '*');
}
