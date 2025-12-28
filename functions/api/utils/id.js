/**
 * @fileoverview 通用工具函数模块
 * 统一的 ID 生成、时间戳、令牌生成等
 */

// ==================== ID 生成 ====================

/**
 * 生成标准 UUID
 * @returns {string} UUID v4 格式
 */
export function generateId() {
    return crypto.randomUUID();
}

/**
 * 生成带前缀的 ID
 * @param {string} prefix - 前缀 (如 'wh_', 'log_', 'usr_')
 * @returns {string}
 */
export function generatePrefixedId(prefix) {
    return prefix + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
}

/**
 * 生成随机分享令牌
 * @param {number} [length=12] - 令牌长度
 * @returns {string}
 */
export function generateShareToken(length = 12) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(array, byte => chars[byte % chars.length]).join('');
}

// ==================== 时间戳 ====================

/**
 * 获取当前时间戳 (毫秒)
 * @returns {number}
 */
export function now() {
    return Date.now();
}

/**
 * 将 ISO 字符串转换为时间戳
 * @param {string} isoString - ISO 8601 格式字符串
 * @returns {number|null}
 */
export function isoToTimestamp(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    return isNaN(date.getTime()) ? null : date.getTime();
}

/**
 * 将时间戳转换为 ISO 字符串
 * @param {number} timestamp - 时间戳 (毫秒)
 * @returns {string}
 */
export function timestampToIso(timestamp) {
    return new Date(timestamp).toISOString();
}

// ==================== 密码哈希 ====================

/**
 * 生成密码哈希
 * @param {string} password - 原始密码
 * @param {string} [salt='salt'] - 盐值
 * @returns {Promise<string>}
 */
export async function hashPassword(password, salt = 'salt') {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ==================== HMAC 签名 ====================

/**
 * 生成 HMAC-SHA256 签名
 * @param {string} payload - 待签名内容
 * @param {string} secret - 密钥
 * @returns {Promise<string>}
 */
export async function generateHmacSignature(payload, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return 'sha256=' + btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// ==================== URL 验证 ====================

/**
 * 验证 URL 格式
 * @param {string} urlString - URL 字符串
 * @returns {boolean}
 */
export function isValidUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}
