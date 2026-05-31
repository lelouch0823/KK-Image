import { getStatusTone, getToneClasses } from '@/design-system/toneContract';

export const STATUS_OPTIONS: string[] = [
  'pending',
  'confirmed',
  'rejected',
  'production',
  'shipping',
  'arrived',
  'fulfilled',
  'delivered',
  'void',
];

const INTERACTIVE_TONE_CLASSES: Record<string, string> = {
  neutral: 'bg-(--bg-muted) text-(--text-secondary) border-(--border-color) hover:bg-(--bg-hover)',
  primary: 'bg-(--color-primary-bg) text-primary border-primary/20 hover:brightness-95',
  success:
    'bg-(--color-success-bg) text-(--color-success-text) border-success/20 hover:brightness-95',
  warning:
    'bg-(--color-warning-bg) text-(--color-warning-text) border-warning/20 hover:brightness-95',
  danger: 'bg-(--color-danger-bg) text-(--color-danger-text) border-danger/20 hover:brightness-95',
  info: 'bg-(--color-info-bg) text-(--color-info-text) border-info/20 hover:brightness-95',
};

const resolveStatusTone = (status: unknown): string => getStatusTone(status as string);

export const STATUS_STYLES: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((status) => {
    const tone = resolveStatusTone(status);
    return [status, INTERACTIVE_TONE_CLASSES[tone] || INTERACTIVE_TONE_CLASSES.neutral];
  })
);

export const STATUS_DOTS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((status) => {
    const tone = resolveStatusTone(status);
    return [status, getToneClasses(tone).dot];
  })
);

export const getStatusVariant = (status: unknown): string => {
  return resolveStatusTone(status);
};

/**
 * 状态十六进制颜色 (用于图表)
 * 直接从共享 tone contract 推导，避免再维护一份独立状态颜色注册表
 */
const TONE_HEX_VARS: Record<string, string> = {
  neutral: 'var(--text-muted)',
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
};

/**
 * 获取状态对应的 hex 颜色值
 */
export const getStatusHexColor = (status: unknown): string => {
  return TONE_HEX_VARS[resolveStatusTone(status)] || 'var(--border-color)';
};

/**
 * 状态徽章样式类 (用于 Tailwind 类)
 */
export const getStatusBadgeClass = (status: unknown): string => {
  return getToneClasses(resolveStatusTone(status)).badge;
};
