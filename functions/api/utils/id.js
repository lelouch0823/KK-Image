/**
 * @fileoverview ID 和 令牌生成工具
 */

/**
 * 生成唯一 ID (基于时间戳和随机数)
 * @returns {string}
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * 生成随机分享令牌
 * @param {number} [length=12] - 令牌长度
 * @returns {string}
 */
export function generateShareToken(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}
