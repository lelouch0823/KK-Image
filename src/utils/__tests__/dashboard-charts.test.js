import { describe, expect, it, afterEach } from 'vitest';
import {
  buildSalesTrendChartConfig,
  buildSalesTrendChartSeries,
  buildStatusDistributionChartConfig,
  buildStatusDistributionChartData,
  colorToRgbChannels,
  getDashboardChartPalette,
  hexToRgbChannels,
  readDashboardCssColor,
  readDashboardCssColorChain,
  withAlpha,
} from '../dashboard-charts';

describe('dashboard chart helpers', () => {
  const palette = {
    primary: '#ec5b13',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    border: '#e5e7eb',
    textMain: '#1a1a1a',
    textSecondary: '#666666',
    textMuted: '#6b7280',
    bgElevated: '#ffffff',
  };

  const t = (key, fallback) => {
    const labels = {
      'dashboard.orderCount': '订单数',
      'order.statuses.pending': '待处理',
      'order.statuses.confirmed': '已确认',
    };
    return labels[key] || fallback || key;
  };

  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('normalizes color values into rgb channels and alpha colors', () => {
    expect(hexToRgbChannels('#123456')).toBe('18, 52, 86');
    expect(hexToRgbChannels('#abc')).toBe('170, 187, 204');
    expect(colorToRgbChannels('rgb(10, 20, 30)')).toBe('10, 20, 30');
    expect(colorToRgbChannels('rgba(10, 20, 30, 0.5)')).toBe('10, 20, 30');
    expect(colorToRgbChannels('var(--missing)', '1, 2, 3')).toBe('1, 2, 3');
    expect(withAlpha('#123456', 0.25)).toBe('rgba(18, 52, 86, 0.25)');
  });

  it('reads dashboard chart colors from css tokens with fallbacks', () => {
    document.documentElement.style.setProperty('--dashboard-test-primary', '#123456');
    document.documentElement.style.setProperty('--dashboard-test-alt', 'rgb(10, 20, 30)');

    expect(readDashboardCssColor('--dashboard-test-primary', 'rgb(0, 0, 0)')).toBe(
      '#123456'
    );
    expect(readDashboardCssColor('--dashboard-test-missing', 'rgb(0, 0, 0)')).toBe(
      'rgb(0, 0, 0)'
    );
    expect(
      readDashboardCssColorChain(
        ['--dashboard-test-missing', '--dashboard-test-alt'],
        'rgb(0, 0, 0)'
      )
    ).toBe('rgb(10, 20, 30)');
  });

  it('builds a dashboard chart palette from theme tokens', () => {
    document.documentElement.style.setProperty('--color-primary', '#123456');
    document.documentElement.style.setProperty('--text-muted', 'rgb(10, 20, 30)');

    expect(getDashboardChartPalette()).toMatchObject({
      primary: '#123456',
      textMuted: 'rgb(10, 20, 30)',
    });
  });

  it('normalizes sales trend data into chart labels and values', () => {
    expect(
      buildSalesTrendChartSeries([
        { date: '2026-06-07', orderCount: 3 },
        { date: '2026-06-08', orderCount: '4' },
        { date: null, orderCount: Number.NaN },
      ])
    ).toEqual({
      labels: ['06-07', '06-08', ''],
      values: [3, 4, 0],
    });
  });

  it('builds status distribution data with shared order labels and tone colors', () => {
    const data = buildStatusDistributionChartData(
      [
        { status: 'pending', count: 2 },
        { status: 'manual_review_required', count: '1' },
      ],
      t,
      palette
    );

    expect(data.labels).toEqual(['待处理', 'Manual Review Required']);
    expect(data.datasets[0].data).toEqual([2, 1]);
    expect(data.datasets[0].backgroundColor).toEqual([palette.warning, palette.textMuted]);
  });

  it('builds sales trend Chart.js config without component-local assembly', () => {
    const config = buildSalesTrendChartConfig({
      data: [{ date: '2026-06-08', orderCount: 5 }],
      t,
      palette,
      backgroundColor: 'gradient',
      isMobile: true,
    });

    expect(config.type).toBe('line');
    expect(config.data.labels).toEqual(['06-08']);
    expect(config.data.datasets[0]).toMatchObject({
      label: '订单数',
      data: [5],
      borderColor: palette.primary,
      borderWidth: 1.5,
      backgroundColor: 'gradient',
    });
    expect(config.options.scales.x.ticks.maxTicksLimit).toBe(5);
    expect(config.options.scales.y.grid.color).toBe('rgba(229, 231, 235, 0.1)');
  });

  it('builds status distribution Chart.js config for desktop and mobile legends', () => {
    const desktop = buildStatusDistributionChartConfig({
      data: [{ status: 'confirmed', count: 7 }],
      t,
      palette,
    });
    const mobile = buildStatusDistributionChartConfig({
      data: [{ status: 'confirmed', count: 7 }],
      t,
      palette,
      isMobile: true,
    });

    expect(desktop.type).toBe('doughnut');
    expect(desktop.data.labels).toEqual(['已确认']);
    expect(desktop.data.datasets[0].backgroundColor).toEqual([palette.info]);
    expect(desktop.options.plugins.legend.position).toBe('right');
    expect(mobile.options.plugins.legend.position).toBe('bottom');
    expect(mobile.options.plugins.legend.labels.font.size).toBe(10);
  });
});
