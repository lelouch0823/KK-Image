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

/**
 * 生成分享页面 URL
 * @param {string} token - 分享令牌
 * @param {string} [origin] - 请求源 (可选，用于完整 URL)
 * @returns {string} 分享页面 URL
 */
export function getShareUrl(token, origin = '') {
    if (!token) return null;
    return `${origin}/gallery/${token}`;
}
