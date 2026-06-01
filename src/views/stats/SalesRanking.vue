<template>
  <div class="space-y-6">
    <!-- 排行榜表格 -->
    <SurfaceSection :title="t('stats.salesRanking')">
      <template #actions>
        <div class="flex items-center gap-2">
          <!-- 时间范围选择 -->
          <div class="flex rounded-lg border border-(--border-color) bg-(--bg-muted)/40 p-0.5">
            <button
              v-for="opt in timeRangeOptions"
              :key="opt.value"
              class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              :class="
                timeRange === opt.value
                  ? 'bg-(--bg-card) text-(--text-main) shadow-sm'
                  : 'text-(--text-secondary) hover:text-(--text-main)'
              "
              @click="selectTimeRange(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
          <!-- 排序选择 -->
          <div class="flex rounded-lg border border-(--border-color) bg-(--bg-muted)/40 p-0.5">
            <button
              v-for="opt in sortOptions"
              :key="opt.value"
              class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              :class="
                sortBy === opt.value
                  ? 'bg-(--bg-card) text-(--text-main) shadow-sm'
                  : 'text-(--text-secondary) hover:text-(--text-main)'
              "
              @click="selectSort(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </template>

      <template #default>
        <!-- 加载状态 -->
        <div v-if="loading" class="space-y-3 p-2">
          <Skeleton v-for="i in 5" :key="i" template="table-row" />
        </div>

        <!-- 无数据 -->
        <div
          v-else-if="ranking.length === 0"
          class="flex h-40 items-center justify-center text-(--text-muted)"
        >
          {{ t('stats.noRankingData') }}
        </div>

        <!-- 排行表格 -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-(--border-color)/70 text-(--text-secondary)">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap" style="width: 60px">
                  {{ t('stats.rank') }}
                </th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap">
                  {{ t('stats.salespersonName') }}
                </th>
                <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">
                  {{ t('stats.totalRevenue') }}
                </th>
                <th class="px-4 py-3 text-right font-semibold whitespace-nowrap">
                  {{ t('stats.avgMonthly') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-(--border-color)/35">
              <tr
                v-for="item in ranking"
                :key="item.id"
                class="transition-colors hover:bg-(--bg-muted)/30"
                :class="{ 'bg-(--bg-muted)/20': item.rank <= 3 }"
              >
                <!-- 排名 -->
                <td class="px-4 py-3">
                  <div
                    v-if="item.rank <= 3"
                    class="inline-flex size-7 items-center justify-center rounded-full text-xs font-bold"
                    :class="medalClass(item.rank)"
                  >
                    {{ item.rank }}
                  </div>
                  <span v-else class="inline-flex size-7 items-center justify-center text-(--text-muted)">
                    {{ item.rank }}
                  </span>
                </td>
                <!-- 销售员 -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex size-8 items-center justify-center rounded-full bg-(--bg-muted) text-xs font-medium text-(--text-secondary)"
                    >
                      {{ item.name?.charAt(0) || '?' }}
                    </div>
                    <div>
                      <div class="font-medium text-(--text-main)">{{ item.name }}</div>
                      <div v-if="item.store" class="text-xs text-(--text-muted)">
                        {{ item.store }}
                      </div>
                    </div>
                  </div>
                </td>
                <!-- 订单数 -->
                <td class="px-4 py-3 text-right font-mono tabular-nums text-(--text-main)">
                  {{ item.orderCount }}
                </td>
                <!-- 月均 -->
                <td class="px-4 py-3 text-right font-mono tabular-nums text-(--text-secondary)">
                  {{ item.avgMonthly }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </SurfaceSection>

    <!-- 业绩柱状图 -->
    <StatsChartWrapper v-if="ranking.length > 0" :title="t('stats.salesRanking')">
      <template #actions>
        <StatusBadge variant="neutral" outline>
          {{ ranking.length }} {{ t('stats.salesperson') }}
        </StatusBadge>
      </template>
      <canvas ref="chartRef"></canvas>
    </StatsChartWrapper>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import { Chart } from '@/utils/chart-setup';
import SurfaceSection from '@/design-system/composed/SurfaceSection.vue';
import StatsChartWrapper from './StatsChartWrapper.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import Skeleton from '@/components/ui/Skeleton.vue';

const { t } = useI18n();
const { authFetch } = useAuth();

const ranking = ref([]);
const loading = ref(false);
const timeRange = ref(null); // null = all time
const sortBy = ref('order_count');
const chartRef = ref(null);
let chartInstance = null;

const timeRangeOptions = [
  { value: 7, label: t('stats.last7Days') },
  { value: 30, label: t('stats.last30Days') },
  { value: 90, label: t('stats.last90Days') },
  { value: null, label: t('stats.allTime') },
];

const sortOptions = [
  { value: 'order_count', label: t('stats.sortByOrderCount') },
  { value: 'avg_monthly', label: t('stats.sortByAvgMonthly') },
];

const medalClass = (rank) => {
  if (rank === 1) return 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300';
  if (rank === 2) return 'bg-gray-100 text-gray-600 ring-1 ring-gray-300';
  if (rank === 3) return 'bg-orange-100 text-orange-700 ring-1 ring-orange-300';
  return '';
};

const loadRanking = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (timeRange.value) params.set('days', String(timeRange.value));
    if (sortBy.value) params.set('sort', sortBy.value);
    params.set('limit', '20');

    const url = `${API.SALESPERSON_RANKING}?${params.toString()}`;
    const response = await authFetch(url);
    if (!response.ok) throw new Error('API Request Failed');

    const json = await response.json();
    ranking.value = json.data || [];

    await nextTick();
    setTimeout(renderChart, 100);
  } catch (err) {
    console.error('Failed to load ranking:', err);
    ranking.value = [];
  } finally {
    loading.value = false;
  }
};

const selectTimeRange = (value) => {
  timeRange.value = value;
  loadRanking();
};

const selectSort = (value) => {
  sortBy.value = value;
  loadRanking();
};

const readCssColorChain = (tokens, fallback = '') => {
  if (typeof document === 'undefined') return fallback;
  const style = getComputedStyle(document.documentElement);
  return tokens.map((token) => style.getPropertyValue(token).trim()).find(Boolean) || fallback;
};

const hexToRgb = (color) => {
  const value = color.replace('#', '').trim();
  if (value.length !== 6) return null;
  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed)) return null;
  return `${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}`;
};

const colorToRgb = (color, fallback) => {
  if (!color) return fallback;
  if (color.startsWith('#')) return hexToRgb(color) || fallback;
  const matched = color.match(/\d+/g);
  if (!matched || matched.length < 3) return fallback;
  return matched.slice(0, 3).join(', ');
};

const withAlpha = (color, alpha, fallback = '0, 0, 0') =>
  `rgba(${colorToRgb(color, fallback)}, ${alpha})`;

const renderChart = () => {
  if (!chartRef.value || ranking.value.length === 0) return;

  if (chartInstance) chartInstance.destroy();

  const palette = {
    primary: readCssColorChain(['--color-primary', '--color-chart-1'], 'rgb(0, 0, 0)'),
    info: readCssColorChain(['--color-info', '--color-chart-2'], 'rgb(0, 0, 0)'),
    success: readCssColorChain(['--color-success', '--color-chart-3'], 'rgb(0, 0, 0)'),
    warning: readCssColorChain(['--color-warning', '--color-chart-4'], 'rgb(0, 0, 0)'),
    danger: readCssColorChain(['--color-danger', '--color-chart-5'], 'rgb(0, 0, 0)'),
    textSecondary: readCssColorChain(['--text-secondary'], 'rgb(0, 0, 0)'),
    bgCard: readCssColorChain(['--bg-card'], 'rgb(255, 255, 255)'),
    border: readCssColorChain(['--border-color'], 'rgb(0, 0, 0)'),
    textMain: readCssColorChain(['--text-main'], 'rgb(0, 0, 0)'),
  };

  const ctx = chartRef.value.getContext('2d');
  const data = ranking.value.slice(0, 10); // Top 10 for chart

  const barColors = [
    withAlpha(palette.warning, 0.85), // gold
    withAlpha(palette.textSecondary, 0.6), // silver
    withAlpha(palette.danger, 0.6), // bronze
    withAlpha(palette.primary, 0.65),
    withAlpha(palette.info, 0.65),
    withAlpha(palette.success, 0.65),
    withAlpha(palette.primary, 0.5),
    withAlpha(palette.info, 0.5),
    withAlpha(palette.success, 0.5),
    withAlpha(palette.warning, 0.5),
  ];

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((item) => {
        const name = item.name || '';
        return name.length > 8 ? name.slice(0, 8) + '...' : name;
      }),
      datasets: [
        {
          label: sortBy.value === 'avg_monthly' ? t('stats.avgMonthly') : t('stats.totalRevenue'),
          data: data.map((item) =>
            sortBy.value === 'avg_monthly' ? item.avgMonthly : item.orderCount
          ),
          backgroundColor: data.map((_, i) => barColors[i] || barColors[barColors.length - 1]),
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
        tooltip: {
          backgroundColor: withAlpha(palette.bgCard, 0.92, '255, 255, 255'),
          titleColor: palette.textMain,
          bodyColor: palette.textSecondary,
          borderColor: palette.border,
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              const value = context.parsed.x;
              return sortBy.value === 'avg_monthly'
                ? `${value} ${t('stats.avgMonthly')}`
                : `${value} ${t('stats.totalRevenue')}`;
            },
          },
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { color: withAlpha(palette.border, 0.3) },
          beginAtZero: true,
          ticks: { color: palette.textSecondary, font: { size: 11 } },
        },
        y: {
          grid: { display: false },
          ticks: { color: palette.textSecondary, font: { size: 11 } },
        },
      },
    },
  });
};

onMounted(() => {
  loadRanking();
});

// 主题变化时重新渲染图表
if (typeof window !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        renderChart();
      }
    });
  });
  observer.observe(document.documentElement, { attributes: true });
  onUnmounted(() => observer.disconnect());
}
</script>
