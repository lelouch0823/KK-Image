<template>
  <div class="min-h-screen bg-(--bg-page) px-6 py-8 text-(--text-main) sm:px-10">
    <DashboardShell :title="t('stats.statusOverview')" :description="t('ai.subtitle')">
      <template #actions>
        <AppButton
          variant="outline"
          :loading="loading"
          :text="t('common.refresh')"
          @click="loadStats"
        >
          <template #icon-left>
            <AppIcon name="arrow-path" class="size-4" />
          </template>
        </AppButton>
      </template>

      <template #main>
        <div v-if="loading && !stats" class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Skeleton v-for="i in 3" :key="i" template="stat-card" />
          <Skeleton class="h-[400px] lg:col-span-2" />
          <Skeleton class="h-[400px]" />
        </div>

        <div
          v-else-if="errorCode === ErrorCode.FORBIDDEN"
          class="flex h-96 flex-col items-center justify-center"
        >
          <PermissionDeniedState
            :title="t('stats.permissionDenied')"
            :description="error || t('stats.permissionDeniedDesc')"
            required-permission="stats:read"
            @retry="loadStats"
          />
        </div>

        <div
          v-else-if="error"
          class="flex h-96 flex-col items-center justify-center gap-4 text-center"
        >
          <div
            class="bg-danger/10 text-danger ring-danger/20 flex size-20 items-center justify-center rounded-full ring-1"
          >
            <AppIcon name="exclamation-triangle" class="size-10" />
          </div>
          <h3 class="text-xl font-semibold text-(--text-main)">{{ t('stats.loadFailed') }}</h3>
          <p class="max-w-md text-(--text-secondary)">{{ error }}</p>
          <AppButton variant="primary" class="mt-2" :text="t('stats.retry')" @click="loadStats" />
        </div>

        <div v-else-if="stats" class="grid gap-6">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
            <AppStatCard
              :label="t('stats.totalFiles')"
              :value="stats.storage?.totalFiles"
              variant="info"
              glow
            >
              <template #icon>
                <AppIcon name="document-text" class="size-6" />
              </template>
              <template #footer>
                <div class="flex items-center gap-2 text-sm font-medium text-(--text-secondary)">
                  <StatusBadge variant="success" class="!px-2 !py-0.5">
                    +{{ formatNumber(stats.storage?.todayUploads) }}
                  </StatusBadge>
                  {{ t('dashboard.todayOrders') }}
                </div>
              </template>
            </AppStatCard>

            <AppStatCard
              :label="t('stats.totalStorage')"
              :value="formatSize(stats.storage?.totalSize)"
              variant="success"
              glow
            >
              <template #icon>
                <AppIcon name="database" class="size-6" />
              </template>
              <template #footer>
                <div class="text-sm font-medium text-(--text-secondary)">
                  {{ t('stats.totalStorage') }}
                </div>
              </template>
            </AppStatCard>

            <AppStatCard
              :label="t('stats.monthVisits')"
              :value="stats.traffic?.monthTotal"
              variant="primary"
              glow
            >
              <template #icon>
                <AppIcon name="eye" class="size-6" />
              </template>
              <template #footer>
                <div class="text-sm font-medium text-(--text-secondary)">
                  {{ t('stats.trafficTrend') }}
                </div>
              </template>
            </AppStatCard>
          </div>

          <SurfaceSection
            :title="t('stats.businessOverview', 'Business Overview')"
            body-class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <MetricTile
              :label="t('stats.totalOrders', 'Total Orders')"
              :value="formatNumber(stats.business?.totalOrders)"
              icon="clipboard-document-list"
              tone="primary"
              flat
            />
            <MetricTile
              :label="t('stats.pendingOrders', 'Pending Orders')"
              :value="formatNumber(stats.business?.pendingOrders)"
              icon="clock"
              tone="warning"
              flat
            />
            <MetricTile
              :label="t('stats.fulfilledOrders', 'Fulfilled Orders')"
              :value="formatNumber(stats.business?.fulfilledOrders)"
              icon="check-circle"
              tone="success"
              flat
            />
            <MetricTile
              :label="t('stats.activeSalespersons', 'Active Salespersons')"
              :value="formatNumber(stats.business?.activeSalespersons)"
              icon="users"
              tone="info"
              flat
            />
          </SurfaceSection>

          <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <StatsChartWrapper class="lg:col-span-2" :title="t('stats.trafficTrend')">
              <canvas ref="trendChartRef"></canvas>
            </StatsChartWrapper>

            <StatsChartWrapper :title="t('stats.fileTypes')">
              <canvas ref="typeChartRef"></canvas>
            </StatsChartWrapper>
          </div>

          <!-- 销售趋势图 (90天) -->
          <StatsChartWrapper :title="t('stats.salesTrend')">
            <template #actions>
              <StatusBadge variant="neutral" outline>
                {{ stats.charts?.salesTrend?.length || 0 }} {{ t('stats.date') }}
              </StatusBadge>
            </template>
            <canvas ref="salesTrendChartRef"></canvas>
          </StatsChartWrapper>

          <!-- 热销排行 + 销售员业绩 -->
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <StatsChartWrapper :title="t('stats.topProducts')">
              <canvas ref="topProductsChartRef"></canvas>
            </StatsChartWrapper>

            <StatsChartWrapper :title="t('stats.salespersonPerformance')">
              <canvas ref="salespersonChartRef"></canvas>
            </StatsChartWrapper>
          </div>

          <!-- 销售业绩排行榜 -->
          <SalesRanking />

          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SurfaceSection :title="t('stats.topSpaces')" body-class="space-y-4">
              <template v-if="stats.traffic?.topSpaces?.length > 0">
                <div
                  v-for="(space, index) in stats.traffic?.topSpaces"
                  :key="space.id"
                  class="group flex items-center justify-between rounded-xl border border-(--border-color) bg-(--bg-muted)/40 p-4 transition-colors hover:border-(--border-hover) hover:bg-(--bg-hover)"
                >
                  <div class="flex min-w-0 items-center gap-4">
                    <StatusBadge :variant="index === 0 ? 'warning' : 'neutral'">
                      {{ index + 1 }}
                    </StatusBadge>
                    <div class="min-w-0">
                      <div class="truncate font-medium text-(--text-main)">{{ space.name }}</div>
                      <div class="mt-1 text-xs text-(--text-muted)">
                        ID: {{ space.id.slice(0, 8) }}
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-mono text-xl font-bold text-(--text-main)">
                      {{ formatNumber(space.views) }}
                    </div>
                    <div class="text-xs tracking-wider text-(--text-muted) uppercase">
                      {{ t('stats.views') }}
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="flex h-40 items-center justify-center text-(--text-muted)">
                {{ t('stats.noData') }}
              </div>
            </SurfaceSection>

            <SurfaceSection
              :title="t('stats.statusOverview')"
              body-class="grid h-full grid-cols-2 gap-4"
            >
              <MetricTile
                :label="t('stats.normal')"
                :value="formatNumber(stats.health?.status?.normal)"
                icon="check-circle"
                tone="success"
                flat
              />
              <MetricTile
                :label="t('stats.blocked')"
                :value="formatNumber(stats.health?.status?.blocked)"
                icon="no-symbol"
                tone="danger"
                flat
              />
              <MetricTile
                :label="t('stats.whitelisted')"
                :value="formatNumber(stats.health?.status?.whitelisted)"
                icon="shield-check"
                tone="info"
                flat
              />
              <MetricTile
                :label="t('stats.liked')"
                :value="formatNumber(stats.health?.status?.liked)"
                icon="heart"
                tone="warning"
                flat
              />
            </SurfaceSection>
          </div>

          <SurfaceSection :title="t('stats.largeFiles')" body-class="p-0">
            <div v-if="stats.storage?.largeFiles?.length > 0" class="p-4 sm:p-5">
              <AppTable :columns="largeFilesColumns" :data="stats.storage?.largeFiles">
                <template #cell-name="{ row, index }">
                  <div class="flex items-center gap-2">
                    <span class="line-clamp-1 max-w-[200px] md:max-w-md">{{ row.name }}</span>
                    <StatusBadge v-if="index < 3" variant="danger">Hot</StatusBadge>
                  </div>
                </template>
                <template #cell-type="{ row }">
                  <span
                    class="inline-flex items-center rounded-md bg-(--bg-muted) px-2 py-1 text-xs font-medium text-(--text-secondary) ring-1 ring-(--border-color) ring-inset"
                  >
                    {{ row.type?.split('/')[1]?.toUpperCase() || 'UNKNOWN' }}
                  </span>
                </template>
                <template #cell-index="{ index }">
                  <span class="text-(--text-secondary)">{{ index + 1 }}</span>
                </template>
                <template #cell-size="{ row }">
                  <span class="text-warning font-mono">{{ formatSize(row.size) }}</span>
                </template>
              </AppTable>
            </div>
            <div v-else class="flex h-32 items-center justify-center p-6 text-(--text-muted)">
              {{ t('stats.noData') }}
            </div>
          </SurfaceSection>
        </div>
      </template>
    </DashboardShell>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, nextTick, onUnmounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { formatSize } from '@/utils/formatters';
import { API } from '@/utils/constants';
import { Chart } from '@/utils/chart-setup';
import 'chartjs-adapter-date-fns';
import AppStatCard from '@/components/ui/AppStatCard.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import SurfaceSection from '@/design-system/composed/SurfaceSection.vue';
import DashboardShell from '@/design-system/patterns/DashboardShell.vue';
import StatsChartWrapper from '@/views/stats/StatsChartWrapper.vue';
import SalesRanking from '@/views/stats/SalesRanking.vue';
import { ErrorCode, isAuthError } from '@/utils/error-codes';
import { classifyError, extractErrorMessage } from '@/utils/api-helpers';

const readCssColor = (token, fallback) => {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
};
const readCssColorChain = (tokens, fallback = '') => {
  if (typeof document === 'undefined') return fallback;
  const style = getComputedStyle(document.documentElement);
  return tokens.map((token) => style.getPropertyValue(token).trim()).find(Boolean) || fallback;
};
const DEFAULT_RGB_CHANNELS = '0, 0, 0';

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

const withAlpha = (color, alpha, fallback = DEFAULT_RGB_CHANNELS) =>
  `rgba(${colorToRgb(color, fallback)}, ${alpha})`;

const getChartPalette = () => {
  return {
    primary: readCssColorChain(['--color-primary', '--color-chart-1'], 'rgb(0, 0, 0)'),
    success: readCssColorChain(['--color-success', '--color-chart-3'], 'rgb(0, 0, 0)'),
    warning: readCssColorChain(['--color-warning', '--color-chart-4'], 'rgb(0, 0, 0)'),
    danger: readCssColorChain(['--color-danger', '--color-chart-5'], 'rgb(0, 0, 0)'),
    info: readCssColorChain(['--color-info', '--color-chart-2'], 'rgb(0, 0, 0)'),
    border: readCssColor('--border-color', 'rgb(0, 0, 0)'),
    textMain: readCssColor('--text-main', 'rgb(0, 0, 0)'),
    textSecondary: readCssColor('--text-secondary', 'rgb(0, 0, 0)'),
    bgCard: readCssColor('--bg-card', 'rgb(255, 255, 255)'),
  };
};

const configureChartDefaults = () => {
  const palette = getChartPalette();
  Chart.defaults.color = palette.textSecondary;
  Chart.defaults.borderColor = withAlpha(palette.border, 0.7);
};
configureChartDefaults();

const { addToast } = useToast();
const { authFetch } = useAuth();
const { t } = useI18n();

// --- State ---
const loading = ref(true);
const error = ref('');
const errorCode = ref(null);
const stats = ref(null);
const trendChartRef = ref(null);
const typeChartRef = ref(null);
const salesTrendChartRef = ref(null);
const topProductsChartRef = ref(null);
const salespersonChartRef = ref(null);

let trendChartInstance = null;
let typeChartInstance = null;
let salesTrendChartInstance = null;
let topProductsChartInstance = null;
let salespersonChartInstance = null;

const largeFilesColumns = computed(() => [
  { key: 'index', label: '#', width: '60px' },
  { key: 'name', label: t('stats.fileName') },
  { key: 'type', label: t('stats.fileType') },
  { key: 'size', label: t('stats.fileSize'), align: 'right' },
]);

// 格式化数字
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
};

const createCharts = () => {
  if (!stats.value) return;
  const palette = getChartPalette();

  // Destroy Old
  if (trendChartInstance) trendChartInstance.destroy();
  if (typeChartInstance) typeChartInstance.destroy();
  if (salesTrendChartInstance) salesTrendChartInstance.destroy();
  if (topProductsChartInstance) topProductsChartInstance.destroy();
  if (salespersonChartInstance) salespersonChartInstance.destroy();

  // 1. Traffic Trend Chart
  if (trendChartRef.value) {
    const ctx = trendChartRef.value.getContext('2d');
    const dailyData = stats.value.traffic?.daily || {};

    // Safety check: if no data, ensure we don't error out
    const labels = Object.keys(dailyData);
    const data = Object.values(dailyData);

    // Gradient Fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, withAlpha(palette.info, 0.4));
    gradient.addColorStop(1, withAlpha(palette.info, 0));

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: t('stats.monthVisits'),
            data: data,
            borderColor: palette.info,
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4, // Smooth curve
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: palette.info,
            pointBorderColor: palette.bgCard,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: withAlpha(palette.bgCard, 0.92, '255, 255, 255'),
            titleColor: palette.textMain,
            bodyColor: palette.textSecondary,
            borderColor: palette.border,
            borderWidth: 1,
            padding: 12,
            displayColors: false,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 7, color: palette.textSecondary },
          },
          y: {
            border: { display: false },
            grid: { color: withAlpha(palette.border, 0.4), opacity: 0.1 },
            beginAtZero: true,
            ticks: { color: palette.textSecondary },
          },
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
  }

  // 2. File Type Chart
  if (typeChartRef.value) {
    const ctx = typeChartRef.value.getContext('2d');
    const fileTypes = stats.value.health?.fileTypes || [];
    const typeData = fileTypes.slice(0, 5).map((i) => ({ ...i })); // Shallow copy to avoid mutation issues

    // Calculate 'Other' only if we have more than 5 types
    if (fileTypes.length > 5) {
      const otherCount = fileTypes.slice(5).reduce((acc, cur) => acc + (cur.count || 0), 0);
      if (otherCount > 0) {
        typeData.push({ type: 'Other', count: otherCount });
      }
    }

    typeChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: typeData.map((i) => i.type.toUpperCase().split('/')[1] || i.type),
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
            labels: {
              usePointStyle: true,
              padding: 20,
              color: palette.textSecondary,
              font: { size: 12 },
            },
          },
          tooltip: {
            backgroundColor: withAlpha(palette.bgCard, 0.92, '255, 255, 255'),
            borderColor: palette.border,
            borderWidth: 1,
          },
        },
      },
    });
  }

  // 3. 销售趋势折线图 (90天)
  if (salesTrendChartRef.value && stats.value.charts?.salesTrend) {
    const ctx = salesTrendChartRef.value.getContext('2d');
    const data = stats.value.charts.salesTrend;

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, withAlpha(palette.primary, 0.3));
    gradient.addColorStop(1, withAlpha(palette.primary, 0));

    salesTrendChartInstance = new Chart(ctx, {
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
            pointBorderColor: palette.bgCard,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: withAlpha(palette.bgCard, 0.92, '255, 255, 255'),
            titleColor: palette.textMain,
            bodyColor: palette.textSecondary,
            borderColor: palette.border,
            borderWidth: 1,
            padding: 12,
            displayColors: false,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 10, color: palette.textSecondary, font: { size: 11 } },
          },
          y: {
            border: { display: false },
            grid: { color: withAlpha(palette.border, 0.4) },
            beginAtZero: true,
            ticks: { color: palette.textSecondary, font: { size: 11 } },
          },
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
  }

  // 4. 热销商品排行 (水平条形图)
  if (topProductsChartRef.value && stats.value.charts?.topProducts) {
    const ctx = topProductsChartRef.value.getContext('2d');
    const data = stats.value.charts.topProducts;

    topProductsChartInstance = new Chart(ctx, {
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
          tooltip: {
            backgroundColor: withAlpha(palette.bgCard, 0.92, '255, 255, 255'),
            titleColor: palette.textMain,
            bodyColor: palette.textSecondary,
            borderColor: palette.border,
            borderWidth: 1,
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
  }

  // 5. 销售员业绩柱状图
  if (salespersonChartRef.value && stats.value.charts?.salespersonStats) {
    const ctx = salespersonChartRef.value.getContext('2d');
    const data = stats.value.charts.salespersonStats;

    salespersonChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map((item) => item.name || '未知'),
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
          tooltip: {
            backgroundColor: withAlpha(palette.bgCard, 0.92, '255, 255, 255'),
            titleColor: palette.textMain,
            bodyColor: palette.textSecondary,
            borderColor: palette.border,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: palette.textSecondary, font: { size: 11 } },
          },
          y: {
            border: { display: false },
            grid: { color: withAlpha(palette.border, 0.3) },
            beginAtZero: true,
            ticks: { color: palette.textSecondary, font: { size: 11 } },
          },
        },
      },
    });
  }
};

const loadStats = async () => {
  // Prevent concurrent loads if already loading (except initial true state)
  // Logic: If already loading and stats are null, it's the initial load.
  // If loading is true but called again, we can let it slide to debounce, or blocking?
  // Simplest for double-fetch fix: The caller should check loading.

  loading.value = true;
  error.value = '';
  errorCode.value = null;
  try {
    const response = await authFetch(API.STATS);
    if (!response.ok) throw new Error('API Request Failed');

    const json = await response.json();
    stats.value = json.data || json;

    // Smooth chart rendering
    await nextTick();
    // Wrap createCharts in try-catch to prevent UI crash
    try {
      setTimeout(createCharts, 100);
    } catch (chartErr) {
      console.warn('Charts failed to render:', chartErr);
    }

    // addToast({ message: t('stats.refreshSuccess'), type: 'success' });
  } catch (err) {
    console.error(err);
    const code = classifyError(err);
    errorCode.value = code;
    // Don't clear stats if refresh fails, just show error toast
    if (!isAuthError(code)) {
      if (!stats.value) {
        error.value = t('stats.loadError');
      }
      addToast({ message: t('stats.loadError'), type: 'error' });
    } else {
      error.value = extractErrorMessage(err, t('common.error.forbidden'));
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadStats();
  const timer = setInterval(loadStats, 300000); // 5 min
  onUnmounted(() => clearInterval(timer));
});

onActivated(() => {
  // Fix double invoke: Only load if not already loading and no data
  if (!stats.value && !loading.value) {
    loadStats();
  }
});

// Watch for theme changes to update charts
if (typeof window !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        configureChartDefaults();
        createCharts();
      }
    });
  });
  observer.observe(document.documentElement, { attributes: true });
  onUnmounted(() => observer.disconnect());
}
</script>

<style scoped>
/* Keyframes available via Tailwind v4 usually, but adding explicit for reliability */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
