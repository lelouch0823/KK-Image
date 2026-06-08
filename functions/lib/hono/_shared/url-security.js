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
  return (
    host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1' || /^127\./.test(host)
  );
}

function parseIpv4Literal(hostname) {
  const host = normalizeHostname(hostname);
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => !Number.isInteger(num) || num < 0 || num > 255)) return null;
  return nums;
}

function ipv4ToNumber(nums) {
  return nums[0] * 0x1000000 + nums[1] * 0x10000 + nums[2] * 0x100 + nums[3];
}

function ipv4InCidr(nums, base, prefixLength) {
  const baseNums = parseIpv4Literal(base);
  if (!baseNums) return false;

  const shift = 32 - prefixLength;
  return (
    Math.floor(ipv4ToNumber(nums) / 2 ** shift) === Math.floor(ipv4ToNumber(baseNums) / 2 ** shift)
  );
}

function isPrivateIpv4(hostname) {
  const nums = parseIpv4Literal(hostname);
  if (!nums) return false;

  return [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ].some(([base, prefixLength]) => ipv4InCidr(nums, base, prefixLength));
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

function parseIpv6ToBigInt(hostname) {
  let host = normalizeHostname(hostname);

  if (host.includes('.')) {
    const lastColon = host.lastIndexOf(':');
    const ipv4 = parseIpv4Literal(host.slice(lastColon + 1));
    if (!ipv4) return null;
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    host = `${host.slice(0, lastColon)}:${high}:${low}`;
  }

  const doubleColonParts = host.split('::');
  if (doubleColonParts.length > 2) return null;

  const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
  const right =
    doubleColonParts.length === 2 && doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
  const hasCompression = doubleColonParts.length === 2;
  const hextetPattern = /^[0-9a-f]{1,4}$/i;
  if ([...left, ...right].some((part) => !hextetPattern.test(part))) return null;

  const missing = 8 - left.length - right.length;
  if ((hasCompression && missing < 1) || (!hasCompression && missing !== 0)) return null;

  const hextets = [...left, ...Array(missing).fill('0'), ...right].map((part) =>
    Number.parseInt(part, 16)
  );
  if (
    hextets.length !== 8 ||
    hextets.some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)
  ) {
    return null;
  }

  return hextets.reduce((acc, part) => (acc << 16n) + BigInt(part), 0n);
}

function ipv6InCidr(value, base, prefixLength) {
  const baseValue = parseIpv6ToBigInt(base);
  if (baseValue == null) return false;
  const shift = 128n - BigInt(prefixLength);
  return value >> shift === baseValue >> shift;
}

function isPrivateIpv6(hostname) {
  const value = parseIpv6ToBigInt(hostname);
  if (value == null) return false;
  const mappedIpv4 = parseIpv4MappedIpv6(hostname);
  if (mappedIpv4) return true;

  return [
    ['::', 128],
    ['::1', 128],
    ['64:ff9b:1::', 48],
    ['100::', 64],
    ['2001::', 32],
    ['2001:2::', 48],
    ['2001:10::', 28],
    ['2001:20::', 28],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
  ].some(([base, prefixLength]) => ipv6InCidr(value, base, prefixLength));
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
  const isPrivate = isLoopbackHost(hostname) || isPrivateIpv4(hostname) || isPrivateIpv6(hostname);
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
