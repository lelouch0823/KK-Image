import { toFiniteNumber } from '../../utils/helpers';
import type { SalesStatsPayload } from '../../services/sales/stats';

interface MetricTone {
  card: string;
  label: string;
  value: string;
}

export interface StatsMetricViewModel {
  key: string;
  label: string;
  value: number;
  helper: string;
  cardStyle: string;
  labelStyle: string;
  valueStyle: string;
}

export interface StatsChartPointViewModel {
  date: string;
  count: number;
  xLabel: string;
  percent: number;
  active: boolean;
}

export interface StatsViewModel {
  metrics: StatsMetricViewModel[];
  chartPoints: StatsChartPointViewModel[];
  showBindWechatAction: boolean;
  isEmpty: boolean;
}

const METRIC_TONES: MetricTone[] = [
  {
    card: 'background:#eff6ff;border:1rpx solid #bfdbfe;',
    label: 'color:#2563eb;',
    value: 'color:#1d4ed8;',
  },
  {
    card: 'background:#f0fdf4;border:1rpx solid #bbf7d0;',
    label: 'color:#15803d;',
    value: 'color:#166534;',
  },
  {
    card: 'background:#faf5ff;border:1rpx solid #e9d5ff;',
    label: 'color:#7c3aed;',
    value: 'color:#6d28d9;',
  },
];

function normalizeTrend(input: SalesStatsPayload['monthlyTrend'] = []) {
  return (Array.isArray(input) ? input : []).map((item) => ({
    date: String(item?.date || ''),
    count: toFiniteNumber(item?.count),
  }));
}

export function createEmptyStatsPayload(): SalesStatsPayload {
  return {
    totalOrders: 0,
    completedOrders: 0,
    monthOrders: 0,
    monthlyTrend: [],
  };
}

export function buildStatsViewModel(
  raw: Partial<SalesStatsPayload>,
  {
    loginMethod,
    hideBindWechatAction = false,
  }: {
    loginMethod?: 'password' | 'wechat' | null;
    hideBindWechatAction?: boolean;
  } = {}
): StatsViewModel {
  const monthlyTrend = normalizeTrend(raw.monthlyTrend);
  const maxCount = Math.max(...monthlyTrend.map((item) => item.count), 1);
  const metrics = [
    { key: 'totalOrders', label: '累计订单', helper: '全部订单', value: toFiniteNumber(raw.totalOrders) },
    { key: 'completedOrders', label: '已完成', helper: '已完结交付', value: toFiniteNumber(raw.completedOrders) },
    { key: 'monthOrders', label: '近 30 天', helper: '最近趋势', value: toFiniteNumber(raw.monthOrders) },
  ].map((item, index) => {
    const tone = METRIC_TONES[index] || METRIC_TONES[0];
    return {
      ...item,
      cardStyle: tone.card,
      labelStyle: tone.label,
      valueStyle: tone.value,
    };
  });

  const chartPoints = monthlyTrend.map((item, index) => ({
    date: item.date,
    count: item.count,
    xLabel: index === 0 || index === monthlyTrend.length - 1 || index === Math.floor(monthlyTrend.length / 2)
      ? item.date.slice(5)
      : '',
    percent: Math.max(12, (item.count / maxCount) * 100),
    active: index === monthlyTrend.length - 1,
  }));

  const metricsTotal = metrics.reduce((sum, item) => sum + item.value, 0);

  return {
    metrics,
    chartPoints,
    showBindWechatAction: loginMethod === 'password' && !hideBindWechatAction,
    isEmpty: metricsTotal === 0 && chartPoints.length === 0,
  };
}
