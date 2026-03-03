export const STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'rejected',
  'production',
  'shipping',
  'arrived',
  'delivered',
  'void',
];

export const STATUS_STYLES = {
  pending:
    'bg-(--color-warning-bg) text-(--color-warning-text) border-warning/20 hover:bg-(--color-warning-bg)/80',
  confirmed:
    'bg-(--color-info-bg) text-(--color-info-text) border-info/20 hover:bg-(--color-info-bg)/80',
  rejected:
    'bg-(--color-danger-bg) text-(--color-danger-text) border-danger/20 hover:bg-(--color-danger-bg)/80',
  production:
    'bg-(--color-purple-bg) text-(--color-purple-text) border-(--color-purple)/20 hover:bg-(--color-purple-bg)/80',
  shipping:
    'bg-(--color-cyan-bg) text-(--color-cyan-text) border-(--color-cyan)/20 hover:bg-(--color-cyan-bg)/80',
  arrived:
    'bg-(--color-success-bg) text-(--color-success-text) border-success/20 hover:bg-(--color-success-bg)/80',
  delivered:
    'bg-(--bg-muted) text-(--text-secondary) border-(--border-color) hover:bg-(--bg-hover)',
};

export const STATUS_DOTS = {
  pending: 'bg-warning',
  confirmed: 'bg-info',
  rejected: 'bg-danger',
  production: 'bg-(--color-purple)',
  shipping: 'bg-(--color-cyan)',
  arrived: 'bg-success',
  delivered: 'bg-(--text-muted)',
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
 * 获取商品状态对应的徽章变体
 * @param {string} status - 商品状态 (active, draft, archived)
 * @returns {string} StatusBadge 变体名称
 */
export const getProductStatusVariant = (status) => {
  const map = {
    active: 'success',
    draft: 'default',
    archived: 'warning',
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
      'bg-(--color-warning-bg) text-(--color-warning-text) border-warning/20',
    confirmed:
      'bg-(--color-info-bg) text-(--color-info-text) border-info/20',
    production:
      'bg-(--color-purple-bg) text-(--color-purple-text) border-(--color-purple)/20',
    shipping:
      'bg-(--color-cyan-bg) text-(--color-cyan-text) border-(--color-cyan)/20',
    arrived:
      'bg-(--color-success-bg) text-(--color-success-text) border-success/20',
    delivered:
      'bg-(--bg-muted) text-(--text-secondary) border-(--border-color)',
    rejected:
      'bg-(--color-danger-bg) text-(--color-danger-text) border-danger/20',
    void: 'bg-(--bg-muted) text-(--text-muted) border-(--border-color)',
  };
  return map[status] || 'bg-(--bg-muted) text-(--text-secondary) border-(--border-color)';
};
