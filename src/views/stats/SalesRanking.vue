<template>
  <div class="space-y-6">
    <!-- 排行榜表格 -->
    <SurfaceSection :title="t('stats.salesRanking')">
      <template #actions>
        <div class="flex items-center gap-2">
          <!-- 时间范围选择 -->
          <div class="flex rounded-lg border border-(--border-color) bg-(--bg-muted)/40 p-0.5">
            <AppButton
              v-for="opt in timeRangeOptions"
              :key="opt.value"
              variant="ghost"
              size="sm"
              class="rounded-md"
              :class="
                timeRange === opt.value
                  ? 'bg-(--bg-card) text-(--text-main) shadow-sm'
                  : 'text-(--text-secondary)'
              "
              @click="selectTimeRange(opt.value)"
            >
              {{ opt.label }}
            </AppButton>
          </div>
          <!-- 排序选择 -->
          <div class="flex rounded-lg border border-(--border-color) bg-(--bg-muted)/40 p-0.5">
            <AppButton
              v-for="opt in sortOptions"
              :key="opt.value"
              variant="ghost"
              size="sm"
              class="rounded-md"
              :class="
                sortBy === opt.value
                  ? 'bg-(--bg-card) text-(--text-main) shadow-sm'
                  : 'text-(--text-secondary)'
              "
              @click="selectSort(opt.value)"
            >
              {{ opt.label }}
            </AppButton>
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
                  {{ t('stats.rankedOrders') }}
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
                  <span
                    v-else
                    class="inline-flex size-7 items-center justify-center text-(--text-muted)"
                  >
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
import { withAlpha, getDashboardChartPalette } from '@/utils/dashboard-charts';
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
  if (rank === 1)
    return 'bg-(--color-warning-bg) text-(--color-warning-text) ring-1 ring-warning/30';
  if (rank === 2) return 'bg-(--bg-muted) text-(--text-secondary) ring-1 ring-(--border-color)';
  if (rank === 3)
    return 'bg-(--color-warning-bg) text-(--color-warning-text) ring-1 ring-warning/30';
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

const renderChart = () => {
  if (!chartRef.value || ranking.value.length === 0) return;

  if (chartInstance) chartInstance.destroy();

  const palette = getDashboardChartPalette();

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
          label: sortBy.value === 'avg_monthly' ? t('stats.avgMonthly') : t('stats.rankedOrders'),
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
          backgroundColor: withAlpha(palette.bgElevated, 0.92, '255, 255, 255'),
          titleColor: palette.textMain,
          bodyColor: palette.textSecondary,
          borderColor: palette.border,
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              const value = context.parsed.x;
              return sortBy.value === 'avg_monthly'
                ? `${value} ${t('stats.avgMonthly')}`
                : `${value} ${t('stats.rankedOrders')}`;
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
