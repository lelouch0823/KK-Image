import { useI18n } from './useI18n';

/**
 * 格式化文件大小
 * @param {number} bytes 字节数
 * @returns {string} 格式化后的字符串 (e.g. "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化日期时间
 * @param {string|number|Date} date 日期
 * @returns {string} 格式化后的字符串 (e.g. "2024-01-01 12:00:00")
 */
export function formatDateTime(date) {
  if (!date) return '-';
  // SOTA: 使用 Intl.DateTimeFormat
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date(date))
    .replace(/\//g, '-');
}

export function useFormat() {
  return {
    formatFileSize,
    formatDateTime,
  };
}
