export const STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'rejected',
  'production',
  'shipping',
  'arrived',
  'delivered',
];

export const STATUS_STYLES = {
  pending:
    'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning)]/20 hover:bg-[var(--color-warning-bg)]/80',
  confirmed:
    'bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info)]/20 hover:bg-[var(--color-info-bg)]/80',
  rejected:
    'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger)]/20 hover:bg-[var(--color-danger-bg)]/80',
  production:
    'bg-[var(--color-purple-bg)] text-[var(--color-purple-text)] border-[var(--color-purple)]/20 hover:bg-[var(--color-purple-bg)]/80',
  shipping:
    'bg-[var(--color-cyan-bg)] text-[var(--color-cyan-text)] border-[var(--color-cyan)]/20 hover:bg-[var(--color-cyan-bg)]/80',
  arrived:
    'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success)]/20 hover:bg-[var(--color-success-bg)]/80',
  delivered:
    'bg-[var(--color-gray-100)] text-[var(--color-gray-600)] border-[var(--color-gray-200)] hover:bg-[var(--color-gray-200)]',
};

export const STATUS_DOTS = {
  pending: 'bg-[var(--color-warning)]',
  confirmed: 'bg-[var(--color-info)]',
  rejected: 'bg-[var(--color-danger)]',
  production: 'bg-[var(--color-purple)]',
  shipping: 'bg-[var(--color-cyan)]',
  arrived: 'bg-[var(--color-success)]',
  delivered: 'bg-[var(--color-gray-500)]',
};

export const getStatusVariant = (status) => {
  const map = {
    pending: 'warning',
    confirmed: 'info',
    rejected: 'error',
    production: 'purple',
    shipping: 'cyan',
    arrived: 'success',
    delivered: 'default',
    void: 'default',
  };
  return map[status] || 'default';
};

/**
 * 状态十六进制颜色 (用于图表)
 * 使用 CSS 变量的对应颜色值，便于后续切换主题
 */
export const STATUS_HEX_COLORS = {
  pending: '#f97316', // orange-500
  confirmed: '#22c55e', // green-500
  production: '#8b5cf6', // violet-500
  shipping: '#3b82f6', // blue-500
  arrived: '#0ea5e9', // sky-500
  delivered: '#64748b', // slate-500
  rejected: '#ef4444', // red-500
  void: '#9ca3af', // gray-400
};

/**
 * 获取状态对应的 hex 颜色值
 * @param {string} status - 状态值
 * @returns {string} hex 颜色值
 */
export const getStatusHexColor = (status) => {
  return STATUS_HEX_COLORS[status] || '#cbd5e1';
};

/**
 * 状态徽章样式类 (用于 Tailwind 类)
 * @param {string} status - 状态值
 * @returns {string} Tailwind 类字符串
 */
export const getStatusBadgeClass = (status) => {
  const map = {
    pending:
      'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning)]/20',
    confirmed:
      'bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info)]/20',
    production:
      'bg-[var(--color-purple-bg)] text-[var(--color-purple-text)] border-[var(--color-purple)]/20',
    shipping:
      'bg-[var(--color-cyan-bg)] text-[var(--color-cyan-text)] border-[var(--color-cyan)]/20',
    arrived:
      'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success)]/20',
    delivered:
      'bg-[var(--color-gray-100)] text-[var(--color-gray-600)] border-[var(--color-gray-200)]',
    rejected:
      'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger)]/20',
    void: 'bg-[var(--color-gray-100)] text-[var(--color-gray-500)] border-[var(--color-gray-200)]',
  };
  return map[status] || 'bg-gray-50 text-gray-600 border-gray-200';
};
