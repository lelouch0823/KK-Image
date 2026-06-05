/**
 * URL 安全验证工具
 * 防止 SSRF 攻击的 URL 验证函数
 *
 * @module lib/hono/_shared/url-security
 */

import { BadRequestError } from '../errors.js';

/**
 * 验证外部 URL 安全性（防止 SSRF）
 * 检查 URL 格式、协议和是否为内网地址
 * @param {string} urlStr - 待验证的 URL 字符串
 * @param {Object} [options] - 选项
 * @param {boolean} [options.allowLocalhost=false] - 是否允许 localhost（用于测试环境）
 * @throws {BadRequestError} URL 不安全时抛出错误
 */
export function assertSafeExternalUrl(urlStr, options = {}) {
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    throw new BadRequestError('无效的 URL 格式');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestError('URL 必须使用 http 或 https 协议');
  }
  const hostname = url.hostname;
  const isLocalhost = /^(127\.|localhost|::1|\[::1\])/i.test(hostname);
  if (isLocalhost && options.allowLocalhost) {
    return;
  }
  const isPrivate = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|localhost|::1|\[::1\])/i.test(hostname);
  if (isPrivate) {
    throw new BadRequestError('不允许使用内网地址');
  }
}
