import { Chart } from '@/utils/chart-setup';
import { withAlpha, getDashboardChartPalette } from '@/utils/dashboard-charts';
import { formatFileTypeLabel } from '@/utils/display-labels';

// --- Chart defaults ---
export const configureChartDefaults = () => {
  const palette = getDashboardChartPalette();
  Chart.defaults.color = palette.textSecondary;
  Chart.defaults.borderColor = withAlpha(palette.border, 0.7);
};

// --- Number formatting ---
export const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
};

// --- Chart refs ---
export function useStatsChartRefs() {
  return {
    trendChartRef: { value: null },
    typeChartRef: { value: null },
    salesTrendChartRef: { value: null },
    topProductsChartRef: { value: null },
    salespersonChartRef: { value: null },
    profitTrendChartRef: { value: null },
    profitByProductChartRef: { value: null },
  };
}

// --- Chart creation ---
export function createAllCharts(stats, chartRefs, t) {
  if (!stats) return;
  const palette = getDashboardChartPalette();

  const instances = {
    trend: null,
    type: null,
    salesTrend: null,
    topProducts: null,
    salesperson: null,
    profitTrend: null,
    profitByProduct: null,
  };

  const tooltipStyle = {
    backgroundColor: withAlpha(palette.bgElevated, 0.92, '255, 255, 255'),
    titleColor: palette.textMain,
    bodyColor: palette.textSecondary,
    borderColor: palette.border,
    borderWidth: 1,
  };

  const axisDefaults = {
    x: { grid: { display: false }, ticks: { color: palette.textSecondary, font: { size: 11 } } },
    y: {
      border: { display: false },
      grid: { color: withAlpha(palette.border, 0.3) },
      beginAtZero: true,
      ticks: { color: palette.textSecondary, font: { size: 11 } },
    },
  };

  // 1. Traffic Trend Chart
  if (chartRefs.trendChartRef.value) {
    const ctx = chartRefs.trendChartRef.value.getContext('2d');
    const dailyData = stats.traffic?.daily || {};
    const labels = Object.keys(dailyData);
    const data = Object.values(dailyData);

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, withAlpha(palette.info, 0.4));
    gradient.addColorStop(1, withAlpha(palette.info, 0));

    instances.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: t('stats.monthVisits'),
            data,
            borderColor: palette.info,
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: palette.info,
            pointBorderColor: palette.bgElevated,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle, padding: 12, displayColors: false },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 7, color: palette.textSecondary } },
          y: {
            border: { display: false },
            grid: { color: withAlpha(palette.border, 0.4) },
            beginAtZero: true,
            ticks: { color: palette.textSecondary },
          },
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
  }

  // 2. File Type Chart (doughnut)
  if (chartRefs.typeChartRef.value) {
    const ctx = chartRefs.typeChartRef.value.getContext('2d');
    const fileTypes = stats.health?.fileTypes || [];
    const typeData = fileTypes.slice(0, 5).map((i) => ({ ...i }));

    if (fileTypes.length > 5) {
      const otherCount = fileTypes.slice(5).reduce((acc, cur) => acc + (cur.count || 0), 0);
      if (otherCount > 0) typeData.push({ type: 'Other', count: otherCount });
    }

    instances.type = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: typeData.map((i) => formatFileTypeLabel(i.type)),
        datasets: [
          {
            data: typeData.map((i) => i.count),
            backgroundColor: [
              palette.info,
              palette.success,
              palette.primary,
              palette.warning,
              palette.danger,
              palette.textSecondary,
            ],
            borderWidth: 0,
            hoverOffset: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: {
            position: 'right',
            labels: { usePointStyle: true, padding: 20, color: palette.textSecondary, font: { size: 12 } },
          },
          tooltip: { ...tooltipStyle },
        },
      },
    });
  }

  // 3. Sales Trend (90 days)
  if (chartRefs.salesTrendChartRef.value && stats.charts?.salesTrend) {
    const ctx = chartRefs.salesTrendChartRef.value.getContext('2d');
    const data = stats.charts.salesTrend;

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, withAlpha(palette.primary, 0.3));
    gradient.addColorStop(1, withAlpha(palette.primary, 0));

    instances.salesTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((item) => item.date?.slice(5) || ''),
        datasets: [
          {
            label: t('stats.orderCount'),
            data: data.map((item) => item.orderCount || 0),
            borderColor: palette.primary,
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointBackgroundColor: palette.primary,
            pointBorderColor: palette.bgElevated,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle, padding: 12, displayColors: false },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10, ...axisDefaults.x.ticks } },
          y: axisDefaults.y,
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
  }

  // 4. Top Products (horizontal bar)
  if (chartRefs.topProductsChartRef.value && stats.charts?.topProducts) {
    const ctx = chartRefs.topProductsChartRef.value.getContext('2d');
    const data = stats.charts.topProducts;

    instances.topProducts = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map((item) => {
          const name = item.productName || '';
          return name.length > 12 ? name.slice(0, 12) + '...' : name;
        }),
        datasets: [
          {
            label: t('stats.orderCount'),
            data: data.map((item) => item.orderCount || 0),
            backgroundColor: [
              withAlpha(palette.primary, 0.8),
              withAlpha(palette.info, 0.8),
              withAlpha(palette.success, 0.8),
              withAlpha(palette.warning, 0.8),
              withAlpha(palette.danger, 0.7),
              withAlpha(palette.primary, 0.6),
              withAlpha(palette.info, 0.6),
              withAlpha(palette.success, 0.6),
              withAlpha(palette.warning, 0.6),
              withAlpha(palette.danger, 0.5),
            ],
            borderWidth: 0,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: tooltipStyle,
        },
        scales: {
          x: { ...axisDefaults.x, grid: { color: withAlpha(palette.border, 0.3) } },
          y: { grid: { display: false }, ticks: axisDefaults.x.ticks },
        },
      },
    });
  }

  // 5. Salesperson Performance (bar)
  if (chartRefs.salespersonChartRef.value && stats.charts?.salespersonStats) {
    const ctx = chartRefs.salespersonChartRef.value.getContext('2d');
    const data = stats.charts.salespersonStats;

    instances.salesperson = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map((item) => item.name || t('common.unknown', '未知')),
        datasets: [
          {
            label: t('stats.orderCount'),
            data: data.map((item) => item.orderCount || 0),
            backgroundColor: withAlpha(palette.info, 0.7),
            borderWidth: 0,
            borderRadius: 4,
            hoverBackgroundColor: withAlpha(palette.info, 0.9),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: tooltipStyle,
        },
        scales: {
          x: axisDefaults.x,
          y: axisDefaults.y,
        },
      },
    });
  }

  // 6. Profit Trend (Revenue + Cost + Profit)
  if (chartRefs.profitTrendChartRef.value && stats.charts?.profitTrend?.length) {
    const ctx = chartRefs.profitTrendChartRef.value.getContext('2d');
    const data = stats.charts.profitTrend;

    instances.profitTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((item) => item.date?.slice(5) || ''),
        datasets: [
          {
            label: t('stats.revenue'),
            data: data.map((item) => item.revenue || 0),
            borderColor: palette.primary,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: t('stats.cost'),
            data: data.map((item) => item.cost || 0),
            borderColor: palette.warning,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: t('stats.profit'),
            data: data.map((item) => item.profit || 0),
            borderColor: palette.success,
            backgroundColor: withAlpha(palette.success, 0.15),
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { usePointStyle: true, padding: 16, color: palette.textSecondary, font: { size: 11 } },
          },
          tooltip: { ...tooltipStyle, padding: 12 },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10, ...axisDefaults.x.ticks } },
          y: { ...axisDefaults.y, grid: { color: withAlpha(palette.border, 0.3) } },
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
  }

  // 7. Profit by Product (horizontal bar)
  if (chartRefs.profitByProductChartRef.value && stats.charts?.profitByProduct?.length) {
    const ctx = chartRefs.profitByProductChartRef.value.getContext('2d');
    const data = stats.charts.profitByProduct;

    instances.profitByProduct = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map((item) => {
          const name = item.productName || '';
          return name.length > 10 ? name.slice(0, 10) + '...' : name;
        }),
        datasets: [
          {
            label: t('stats.profit'),
            data: data.map((item) => item.profit || 0),
            backgroundColor: data.map((item) =>
              (item.profit || 0) >= 0
                ? withAlpha(palette.success, 0.7)
                : withAlpha(palette.danger, 0.7)
            ),
            borderWidth: 0,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: tooltipStyle,
        },
        scales: {
          x: { ...axisDefaults.x, grid: { color: withAlpha(palette.border, 0.3) } },
          y: { grid: { display: false }, ticks: axisDefaults.x.ticks },
        },
      },
    });
  }

  return instances;
}
