export const CANONICAL_TONES = Object.freeze([
  'neutral',
  'primary',
  'success',
  'warning',
  'danger',
  'info',
]);

const LEGACY_TONE_ALIASES = Object.freeze({
  default: 'neutral',
  slate: 'neutral',
  blue: 'info',
  teal: 'info',
  cyan: 'info',
  purple: 'primary',
  indigo: 'primary',
  orange: 'warning',
  amber: 'warning',
  pink: 'danger',
  rose: 'danger',
});

const TONE_CLASS_SETS = Object.freeze({
  neutral: {
    badge: 'bg-(--bg-muted) text-(--text-secondary) border-(--border-color)',
    badgeOutline: 'bg-transparent text-(--text-secondary) border-(--border-color)',
    surface: 'border-(--border-color) bg-(--bg-card)',
    accentText: 'text-(--text-secondary)',
    iconSurface: 'bg-(--bg-muted) text-(--text-secondary)',
    dot: 'bg-(--text-muted)',
    blob: 'bg-(--bg-muted)',
  },
  primary: {
    badge: 'bg-(--color-primary-bg) text-primary border-primary/20',
    badgeOutline: 'bg-transparent text-primary border-primary/30',
    surface: 'border-primary/20 bg-(--color-primary-bg)',
    accentText: 'text-primary',
    iconSurface: 'bg-(--color-primary-bg) text-primary',
    dot: 'bg-primary',
    blob: 'bg-(--color-primary-bg)',
  },
  success: {
    badge: 'bg-(--color-success-bg) text-(--color-success-text) border-success/20',
    badgeOutline: 'bg-transparent text-success border-success/30',
    surface: 'border-success/20 bg-(--color-success-bg)',
    accentText: 'text-success',
    iconSurface: 'bg-(--color-success-bg) text-success',
    dot: 'bg-success',
    blob: 'bg-(--color-success-bg)',
  },
  warning: {
    badge: 'bg-(--color-warning-bg) text-(--color-warning-text) border-warning/20',
    badgeOutline: 'bg-transparent text-warning border-warning/30',
    surface: 'border-warning/20 bg-(--color-warning-bg)',
    accentText: 'text-warning',
    iconSurface: 'bg-(--color-warning-bg) text-warning',
    dot: 'bg-warning',
    blob: 'bg-(--color-warning-bg)',
  },
  danger: {
    badge: 'bg-(--color-danger-bg) text-(--color-danger-text) border-danger/20',
    badgeOutline: 'bg-transparent text-danger border-danger/30',
    surface: 'border-danger/20 bg-(--color-danger-bg)',
    accentText: 'text-danger',
    iconSurface: 'bg-(--color-danger-bg) text-danger',
    dot: 'bg-danger',
    blob: 'bg-(--color-danger-bg)',
  },
  info: {
    badge: 'bg-(--color-info-bg) text-(--color-info-text) border-info/20',
    badgeOutline: 'bg-transparent text-info border-info/30',
    surface: 'border-info/20 bg-(--color-info-bg)',
    accentText: 'text-info',
    iconSurface: 'bg-(--color-info-bg) text-info',
    dot: 'bg-info',
    blob: 'bg-(--color-info-bg)',
  },
});

const STATUS_TONE_MAP = Object.freeze({
  pending: 'warning',
  confirmed: 'info',
  production: 'primary',
  shipping: 'info',
  arrived: 'success',
  fulfilled: 'success',
  completed: 'success',
  delivered: 'success',
  rejected: 'danger',
  void: 'neutral',
  cancelled: 'neutral',
});

export function normalizeTone(tone = 'neutral') {
  if (!tone) return 'neutral';
  if (CANONICAL_TONES.includes(tone)) return tone;
  return LEGACY_TONE_ALIASES[tone] || 'neutral';
}

export function getToneClasses(tone = 'neutral') {
  return TONE_CLASS_SETS[normalizeTone(tone)] || TONE_CLASS_SETS.neutral;
}

export function getStatusTone(status) {
  return normalizeTone(STATUS_TONE_MAP[status] || 'neutral');
}

export function getStatusDotClass(status) {
  return getToneClasses(getStatusTone(status)).dot;
}
