/**
 * 通用格式化工具函数
 * @module utils/formatters
 */

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
export const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 格式化日期时间
 * @param {number|string} timestamp - 时间戳
 * @param {Object} options - Intl.DateTimeFormat 选项
 * @returns {string} 格式化后的日期字符串
 */
export const formatDate = (timestamp, options = {}) => {
    if (!timestamp) return '-';
    const date = new Date(Number(timestamp));
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...options
    });
};

/**
 * 格式化过期时间
 * @param {number} ts - 过期时间戳
 * @returns {string} 格式化后的过期时间描述
 */
export const formatExpiry = (ts) => {
    if (!ts) return '永久有效';
    const date = new Date(Number(ts));
    const now = Date.now();
    const days = Math.ceil((ts - now) / (1000 * 60 * 60 * 24));

    if (ts < now) return '已过期';
    return `${days}天后 (${date.toLocaleDateString()})`;
};

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 大写的扩展名
 */
export const getFileExtension = (filename) => {
    if (!filename) return '';
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toUpperCase();
};

/**
 * 判断是否为图片文件
 * @param {Object|string} file - 文件对象或文件名
 * @returns {boolean} 是否为图片
 */
export const isImage = (file) => {
    if (!file) return false;

    // 支持传入文件对象或字符串
    const filename = typeof file === 'string' ? file : (file.name || file.originalName || '');
    if (!filename) return false;

    const ext = getFileExtension(filename).toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    return imageExtensions.includes(ext);
};

