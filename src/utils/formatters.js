// No hardcoded default messages here

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @param {Object} t - i18n translate function (可选)
 * @returns {string} 格式化后的大小字符串
 */
export const formatSize = (bytes, t) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  const unit = t ? t(`formatters.units.${sizes[i]}`) : sizes[i];

  return `${value} ${unit}`;
};

/**
 * 格式化时长 (秒 -> 时:分:秒)
 * @param {number} seconds - 秒数
 * @param {Object} t - i18n translate function
 */
export const formatDuration = (seconds, t) => {
  if (!t) return `${seconds}s`;
  if (seconds < 60) return `${seconds}${t('formatters.seconds')}`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}${t('formatters.minutes')}${seconds % 60}${t('formatters.seconds')}`;
  return `${Math.floor(seconds / 3600)}${t('formatters.hours')}${Math.floor((seconds % 3600) / 60)}${t('formatters.minutes')}`;
};

/**
 * 格式化日期时间
 * @param {number|string} timestamp - 时间戳
 * @param {Object} options - Intl.DateTimeFormat 选项
 * @returns {string} 格式化后的日期字符串
 */
export const formatDate = (timestamp, options = {}) => {
  if (!timestamp) return '-';
  const { locale, ...restOptions } = options;
  const date = new Date(Number(timestamp));
  return date.toLocaleString(locale || 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...restOptions,
  });
};

/**
 * 格式化过期时间
 * @param {number} ts - 过期时间戳
 * @param {function} t - 国际化翻译函数
 * @returns {string} 格式化后的过期时间描述
 */
export const formatExpiry = (ts, t) => {
  if (!t) {
    if (!ts) return '-';
    return new Date(Number(ts)).toLocaleDateString();
  }

  if (!ts) return t('formatters.forever', '永久有效');
  const date = new Date(Number(ts));
  const now = Date.now();
  const days = Math.ceil((ts - now) / (1000 * 60 * 60 * 24));

  if (ts < now) return t('formatters.expired', '已过期');
  const dateStr = date.toLocaleDateString();
  return t('formatters.daysLeft', { days, date: dateStr });
};

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 大写的扩展名
 */
export const getFileExtension = (filename) => {
  if (!filename) return '';
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toUpperCase();
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
  const filename = typeof file === 'string' ? file : file.name || file.originalName || '';
  if (!filename) return false;

  const ext = getFileExtension(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
};

/**
 * 判断是否为 PDF 文件
 * @param {Object|string} file - 文件对象或文件名
 * @returns {boolean} 是否为 PDF
 */
export const isPdf = (file) => {
  if (!file) return false;
  const filename = typeof file === 'string' ? file : file.name || file.originalName || '';
  if (!filename) return false;
  return getFileExtension(filename).toLowerCase() === 'pdf';
};

/**
 * 格式化相对时间 (刚刚, x分钟前, x小时前, 或日期)
 * @param {number|string} timestamp - 时间戳
 * @param {function} t - i18n t function
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (timestamp, t) => {
  if (!timestamp) return t ? t('common.unknown') : '';
  const date = new Date(Number(timestamp));
  const now = new Date();
  const diff = now - date;

  // 必须提供 t 函数，否则返回空字符串 (SOTA: 避免硬编码)
  if (!t) return '';

  // 一分钟内
  if (diff < 60000) return t('common.justNow');
  // 一小时内
  if (diff < 3600000) {
    const count = Math.floor(diff / 60000);
    return t('common.minutesAgo', { count });
  }
  // 一天内
  if (diff < 86400000) {
    const count = Math.floor(diff / 3600000);
    return t('common.hoursAgo', { count });
  }

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

/**
 * formatTime 别名 - 用于排序列表的时间显示
 * @param {number|string} timestamp
 * @returns {string}
 */
export const formatTime = formatTimelineTime;

/**
 * 获取 CSS 变量值
 * @param {string} varName - CSS 变量名 (如 '--color-chart-1')
 * @returns {string}
 */
export const getCssVar = (varName) => {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
};

/**
 * 获取图表颜色数组
 * @param {number} count - 需要的颜色数量
 * @returns {string[]}
 */
export const getChartColors = (count = 6) => {
  const colors = [];
  for (let i = 1; i <= Math.min(count, 6); i++) {
    colors.push(getCssVar(`--color-chart-${i}`));
  }
  return colors;
};

/**
 * 将 Hex 颜色转为 RGBA
 * @param {string} hex - Hex 颜色值
 * @param {number} alpha - 透明度 (0-1)
 * @returns {string}
 */
export const hexToRgba = (hex, alpha = 1) => {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * 获取图表背景色 (带透明度)
 * @param {number} index - 颜色索引 (1-6)
 * @param {number} alpha - 透明度 (0-1)
 * @returns {string}
 */
export const getChartBgColor = (index = 1, alpha = 0.1) => {
  const hex = getCssVar(`--color-chart-${index}`);
  return hexToRgba(hex, alpha);
};

/**
 * 格式化日期+星期
 * @param {string} dateString YYYY-MM-DD
 * @param {Function} t i18n translate function
 * @returns {string} YYYY-MM-DD (周X)
 */
export function formatDateWithWeekday(dateString, t) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  let dayStr;
  if (t) {
    dayStr = t(`common.weekdays.${date.getDay()}`);
  } else {
    // SOTA: Fallback to non-localized if t not available, but avoid hardcoded arrays
    return dateString;
  }

  return `${dateString} (${dayStr})`;
}

/**
 * 格式化金额
 * @param {number|string} amount - 金额
 * @param {string} currency - 货币代码 (默认 CNY)
 * @returns {string} 格式化后的金额字符串
 */
export const formatCurrency = (amount, currency = 'CNY') => {
  if (amount === undefined || amount === null || amount === '') return '-';

  // 确保是数字
  const num = Number(amount);
  if (isNaN(num)) return amount;

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};
