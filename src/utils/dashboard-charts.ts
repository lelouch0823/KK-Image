import { formatOrderStatusLabel } from './display-labels';
import { getStatusVariant } from './status';

type TranslateFn = (key: string, fallback?: string) => string;

type CssReaderRoot = Element | null;

type DashboardChartPalette = {
  primary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  chartProduction: string;
  chartShipping: string;
  chartDelivered: string;
  border: string;
  textMain: string;
  textSecondary: string;
  textMuted: string;
  bgElevated: string;
};

type DashboardChartItem = Record<string, unknown>;

type DashboardChartConfigOptions = {
  data?: DashboardChartItem[];
  t?: TranslateFn;
  palette?: DashboardChartPalette;
  backgroundColor?: unknown;
  isMobile?: boolean;
};

const DEFAULT_RGB_CHANNELS = '0, 0, 0';

const DEFAULT_TRANSLATE: TranslateFn = (key, fallback) => fallback || key;

const COLOR_TOKEN_CONFIG = {
  primary: {
    tokens: ['--color-primary', '--color-chart-1'],
    fallback: 'rgb(236, 91, 19)',
  },
  success: {
    tokens: ['--color-success', '--color-chart-3'],
    fallback: 'rgb(16, 185, 129)',
  },
  warning: {
    tokens: ['--color-warning', '--color-chart-4'],
    fallback: 'rgb(245, 158, 11)',
  },
  danger: {
    tokens: ['--color-danger', '--color-chart-5'],
    fallback: 'rgb(239, 68, 68)',
  },
  info: {
    tokens: ['--color-info', '--color-chart-2'],
    fallback: 'rgb(59, 130, 246)',
  },
  chartProduction: {
    tokens: ['--color-chart-production'],
    fallback: 'rgb(124, 100, 190)',
  },
  chartShipping: {
    tokens: ['--color-chart-shipping'],
    fallback: 'rgb(6, 182, 212)',
  },
  chartDelivered: {
    tokens: ['--color-chart-delivered'],
    fallback: 'rgb(34, 197, 94)',
  },
  border: {
    tokens: ['--border-color', '--color-chart-grid'],
    fallback: 'rgb(229, 231, 235)',
  },
  textMain: {
    tokens: ['--text-main'],
    fallback: 'rgb(26, 26, 26)',
  },
  textSecondary: {
    tokens: ['--text-secondary'],
    fallback: 'rgb(102, 102, 102)',
  },
  textMuted: {
    tokens: ['--text-muted'],
    fallback: 'rgb(107, 114, 128)',
  },
  bgElevated: {
    tokens: ['--bg-elevated', '--bg-card'],
    fallback: 'rgb(255, 255, 255)',
  },
} as const;

const STATUS_TONE_PALETTE_KEYS: Record<string, keyof DashboardChartPalette> = {
  danger: 'danger',
  info: 'info',
  neutral: 'textMuted',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
};

const STATUS_CHART_PALETTE_KEYS: Record<string, keyof DashboardChartPalette> = {
  pending: 'warning',
  confirmed: 'info',
  production: 'chartProduction',
  shipping: 'chartShipping',
  arrived: 'success',
  fulfilled: 'success',
  delivered: 'chartDelivered',
  rejected: 'danger',
  void: 'textMuted',
};

function getTranslate(t?: TranslateFn): TranslateFn {
  return typeof t === 'function' ? t : DEFAULT_TRANSLATE;
}

function getStyle(root?: CssReaderRoot): CSSStyleDeclaration | null {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return null;
  const target = root || document.documentElement;
  return target ? getComputedStyle(target) : null;
}

function normalizeChartItems(data: unknown): DashboardChartItem[] {
  return Array.isArray(data) ? data : [];
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toShortDateLabel(value: unknown): string {
  const raw = String(value || '').trim();
  return raw ? raw.slice(5) : '';
}

function normalizeHex(value: string): string | null {
  const trimmed = value.replace('#', '').trim();
  if (trimmed.length === 3) {
    return trimmed
      .split('')
      .map((part) => part + part)
      .join('');
  }
  if (trimmed.length === 6) return trimmed;
  return null;
}

export function hexToRgbChannels(color: unknown): string | null {
  const raw = String(color || '').trim();
  if (!raw.startsWith('#')) return null;
  const value = normalizeHex(raw);
  if (!value) return null;
  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed)) return null;
  return `${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}`;
}

export function colorToRgbChannels(color: unknown, fallback = DEFAULT_RGB_CHANNELS): string {
  const raw = String(color || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('#')) return hexToRgbChannels(raw) || fallback;

  const matched = raw.match(/\d*\.?\d+/g);
  if (!matched || matched.length < 3) return fallback;
  return matched.slice(0, 3).join(', ');
}

export function withAlpha(color: unknown, alpha: number, fallback = DEFAULT_RGB_CHANNELS): string {
  return `rgba(${colorToRgbChannels(color, fallback)}, ${alpha})`;
}

export function readDashboardCssColor(
  token: string,
  fallback: string,
  root?: CssReaderRoot
): string {
  const style = getStyle(root);
  if (!style) return fallback;
  return style.getPropertyValue(token).trim() || fallback;
}

export function readDashboardCssColorChain(
  tokens: readonly string[],
  fallback: string,
  root?: CssReaderRoot
): string {
  const style = getStyle(root);
  if (!style) return fallback;
  return tokens.map((token) => style.getPropertyValue(token).trim()).find(Boolean) || fallback;
}

export function getDashboardChartPalette(root?: CssReaderRoot): DashboardChartPalette {
  return Object.entries(COLOR_TOKEN_CONFIG).reduce((palette, [key, config]) => {
    palette[key as keyof DashboardChartPalette] = readDashboardCssColorChain(
      config.tokens,
      config.fallback,
      root
    );
    return palette;
  }, {} as DashboardChartPalette);
}

export function createLineChartGradient(
  ctx: CanvasRenderingContext2D,
  color: unknown,
  height = 250,
  startAlpha = 0.3,
  endAlpha = 0
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, withAlpha(color, startAlpha));
  gradient.addColorStop(1, withAlpha(color, endAlpha));
  return gradient;
}

export function buildSalesTrendChartSeries(data: unknown): { labels: string[]; values: number[] } {
  const items = normalizeChartItems(data);
  return {
    labels: items.map((item) => toShortDateLabel(item.date)),
    values: items.map((item) => toFiniteNumber(item.orderCount)),
  };
}

export function resolveDashboardStatusColor(
  status: unknown,
  palette: DashboardChartPalette = getDashboardChartPalette()
): string {
  const raw = String(status || '').trim();
  const statusPaletteKey = STATUS_CHART_PALETTE_KEYS[raw];
  if (statusPaletteKey && palette[statusPaletteKey]) return palette[statusPaletteKey];

  const tone = getStatusVariant(status);
  const paletteKey = STATUS_TONE_PALETTE_KEYS[tone] || 'textMuted';
  return palette[paletteKey] || palette.textMuted;
}

export function buildStatusDistributionChartData(
  data: unknown,
  t?: TranslateFn,
  palette: DashboardChartPalette = getDashboardChartPalette()
): {
  labels: string[];
  datasets: Array<{
    data: number[];
    backgroundColor: string[];
    borderWidth: number;
    hoverOffset: number;
  }>;
} {
  const translate = getTranslate(t);
  const items = normalizeChartItems(data);
  return {
    labels: items.map((item) => formatOrderStatusLabel(translate, item.status)),
    datasets: [
      {
        data: items.map((item) => toFiniteNumber(item.count)),
        backgroundColor: items.map((item) => resolveDashboardStatusColor(item.status, palette)),
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };
}

export function buildSalesTrendChartConfig({
  data = [],
  t,
  palette = getDashboardChartPalette(),
  backgroundColor,
  isMobile = false,
}: DashboardChartConfigOptions = {}) {
  const translate = getTranslate(t);
  const series = buildSalesTrendChartSeries(data);

  return {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: translate('dashboard.orderCount'),
          data: series.values,
          borderColor: palette.primary,
          borderWidth: isMobile ? 1.5 : 2,
          backgroundColor,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: palette.bgElevated,
          titleColor: palette.textMain,
          bodyColor: palette.textSecondary,
          borderColor: palette.border,
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: isMobile ? 5 : 8,
            color: palette.textMuted,
            font: { size: isMobile ? 9 : 11 },
            maxRotation: isMobile ? 45 : 0,
          },
        },
        y: {
          border: { display: false },
          grid: {
            color: withAlpha(palette.border, 0.1, '229, 231, 235'),
          },
          beginAtZero: true,
          ticks: {
            color: palette.textMuted,
            font: { size: isMobile ? 9 : 11 },
            maxTicksLimit: isMobile ? 5 : 8,
          },
        },
      },
      interaction: { intersect: false, mode: 'index' },
    },
  };
}

export function buildStatusDistributionChartConfig({
  data = [],
  t,
  palette = getDashboardChartPalette(),
  isMobile = false,
}: DashboardChartConfigOptions = {}) {
  return {
    type: 'doughnut',
    data: buildStatusDistributionChartData(data, t, palette),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: isMobile ? 'bottom' : 'right',
          labels: {
            usePointStyle: true,
            padding: isMobile ? 8 : 12,
            color: palette.textMuted,
            font: { size: isMobile ? 10 : 11 },
            boxWidth: isMobile ? 8 : 12,
          },
        },
        tooltip: {
          backgroundColor: palette.bgElevated,
          titleColor: palette.textMain,
          bodyColor: palette.textSecondary,
          borderColor: palette.border,
          borderWidth: 1,
        },
      },
    },
  };
}
