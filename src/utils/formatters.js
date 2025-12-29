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
 * @param {function} t - 国际化翻译函数 (可选)
 * @returns {string} 格式化后的过期时间描述
 */
export const formatExpiry = (ts, t) => {
    if (!ts) return t ? t('formatters.forever') : '永久有效';
    const date = new Date(Number(ts));
    const now = Date.now();
    const days = Math.ceil((ts - now) / (1000 * 60 * 60 * 24));

    if (ts < now) return t ? t('formatters.expired') : '已过期';
    const dateStr = date.toLocaleDateString();
    return t ? t('formatters.daysLeft', { days, date: dateStr }) : `${days}天后 (${dateStr})`;
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

import { IMAGE_EXTENSIONS } from './constants';

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
    return IMAGE_EXTENSIONS.includes(ext);
};

/**
 * 格式化相对时间 (刚刚, x分钟前, x小时前, 或日期)
 * @param {number|string} timestamp - 时间戳
 * @param {function} t - i18n t function
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (timestamp, t) => {
    if (!timestamp) return '';
    const date = new Date(Number(timestamp));
    const now = new Date();
    const diff = now - date;

    // 一分钟内
    if (diff < 60000) return t ? t('stats.justNow') : '刚刚';
    // 一小时内
    if (diff < 3600000) return t ? t('stats.minutesAgo', { count: Math.floor(diff / 60000) }) : `${Math.floor(diff / 60000)}分钟前`;
    // 一天内
    if (diff < 86400000) return t ? t('stats.hoursAgo', { count: Math.floor(diff / 3600000) }) : `${Math.floor(diff / 3600000)}小时前`;

    // 超过一天，显示日期 (MM/DD)
    return `${date.getMonth() + 1}/${date.getDate()}`;
};

/**
 * 格式化详细时间 (MM/DD HH:mm) - 用于时间轴
 * @param {number|string} timestamp 
 * @returns {string}
 */
export const formatTimelineTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(Number(timestamp));
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (isToday) {
        return timeStr;
    }
    return `${date.getMonth() + 1}/${date.getDate()} ${timeStr}`;
};
