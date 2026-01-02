/**
 * URL 生成工具
 * @module api/utils/url
 */

/**
 * 生成文件访问 URL
 * @param {string} storageKey - 文件存储键/ID
 * @param {string} [origin] - 请求源 (可选，用于完整 URL)
 * @returns {string} 文件 URL
 */
export function getFileUrl(storageKey, origin = '') {
  if (!storageKey) return null;
  return `${origin}/file/${storageKey}`;
}

export function getShareUrl(token, type = 'gallery') {
  if (!token) return null;
  const path = type === 'space' ? 'space' : 'gallery';
  return `/${path}/${token}`;
}
