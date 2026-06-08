/**
 * URL 安全验证工具
 * 防止 SSRF 攻击的 URL 验证函数
 *
 * @module lib/hono/_shared/url-security
 */

import { BadRequestError } from '../errors.js';

function normalizeHostname(hostname = '') {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function isLoopbackHost(hostname) {
  const host = normalizeHostname(hostname);
  return host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1' || /^127\./.test(host);
}

function isPrivateIpv4(hostname) {
  const host = normalizeHostname(hostname);
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => !Number.isInteger(num) || num < 0 || num > 255)) return false;
  const [a, b] = nums;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function parseIpv4MappedIpv6(hostname) {
  const host = normalizeHostname(hostname);
  const dotted = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dotted) return dotted[1];

  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return null;

  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  if (![high, low].every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff)) {
    return null;
  }

  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isLoopbackIpv4MappedIpv6(hostname) {
  const mapped = parseIpv4MappedIpv6(hostname);
  return mapped ? isLoopbackHost(mapped) : false;
}

function isPrivateIpv6(hostname) {
  const host = normalizeHostname(hostname);
  const first = host.split(':')[0] || '';
  const mappedIpv4 = parseIpv4MappedIpv6(hostname);
  return (
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    Boolean(mappedIpv4 && isPrivateIpv4(mappedIpv4)) ||
    /^fe[89ab][0-9a-f]?$/i.test(first) ||
    /^f[cd][0-9a-f]{2}$/i.test(first)
  );
}

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
  const hostname = normalizeHostname(url.hostname);
  const isLocalhost = isLoopbackHost(hostname) || isLoopbackIpv4MappedIpv6(hostname);
  if (isLocalhost && options.allowLocalhost) {
    return;
  }
  const isPrivate =
    isLoopbackHost(hostname) || isPrivateIpv4(hostname) || isPrivateIpv6(hostname);
  if (isPrivate) {
    throw new BadRequestError('不允许使用内网地址');
  }
}

export function buildSafeExternalFetchOptions({ timeoutMs = 10000, ...options } = {}) {
  return {
    ...options,
    redirect: 'manual',
    signal: options.signal || AbortSignal.timeout(timeoutMs),
  };
}
