<template>
  <div class="text-(--text-main)">
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
          <StatGroup :columns="3">
            <MetricTile
              :label="t('stats.totalFiles')"
              :value="stats.storage?.totalFiles"
              icon="document-text"
              tone="info"
              flat
            >
              <template #meta>
                <StatusBadge variant="success" class="!px-2 !py-0.5">
                  +{{ formatNumber(stats.storage?.todayUploads) }}
                </StatusBadge>
                <span>{{ t('dashboard.todayOrders') }}</span>
              </template>
            </MetricTile>

            <MetricTile
              :label="t('stats.totalStorage')"
              :value="formatSize(stats.storage?.totalSize)"
              icon="database"
              tone="success"
              flat
            />

            <MetricTile
              :label="t('stats.monthVisits')"
              :value="stats.traffic?.monthTotal"
              icon="eye"
              tone="primary"
              flat
            />
          </StatGroup>

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

          <!-- 利润概览 -->
          <SurfaceSection
            v-if="stats.profit"
            :title="t('stats.profitOverview')"
            body-class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <MetricTile
              :label="t('stats.totalRevenue')"
              :value="formatCurrencyCompact(stats.profit?.totalRevenue)"
              icon="banknotes"
              tone="primary"
              flat
            />
            <MetricTile
              :label="t('stats.totalCost')"
              :value="formatCurrencyCompact(stats.profit?.totalCost)"
              icon="shopping-cart"
              tone="warning"
              flat
            />
            <MetricTile
              :label="t('stats.totalProfit')"
              :value="formatCurrencyCompact(stats.profit?.totalProfit)"
              icon="chart-bar"
              :tone="(stats.profit?.totalProfit ?? 0) >= 0 ? 'success' : 'danger'"
              flat
            />
            <MetricTile
              :label="t('stats.profitMargin')"
              :value="stats.profit?.margin != null ? stats.profit.margin + '%' : '-'"
              icon="presentation-chart-line"
              :tone="(stats.profit?.margin ?? 0) >= 0 ? 'success' : 'danger'"
              flat
            />
          </SurfaceSection>

          <!-- 利润趋势图 -->
          <div
            v-if="stats.charts?.profitTrend?.length"
            class="grid grid-cols-1 gap-6 lg:grid-cols-3"
          >
            <StatsChartWrapper class="lg:col-span-2" :title="t('stats.profitTrend')">
              <canvas ref="profitTrendChartRef"></canvas>
            </StatsChartWrapper>

            <StatsChartWrapper :title="t('stats.profitByProduct')">
              <canvas ref="profitByProductChartRef"></canvas>
            </StatsChartWrapper>
          </div>

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
                    {{ formatFileTypeLabel(row.type) }}
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
import { formatSize, formatCurrencyCompact } from '@/utils/formatters';
import { API } from '@/utils/constants';
import 'chartjs-adapter-date-fns';
import AppTable from '@/components/ui/AppTable.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import StatGroup from '@/design-system/composed/StatGroup.vue';
import SurfaceSection from '@/design-system/composed/SurfaceSection.vue';
import DashboardShell from '@/design-system/patterns/DashboardShell.vue';
import StatsChartWrapper from '@/views/stats/StatsChartWrapper.vue';
import SalesRanking from '@/views/stats/SalesRanking.vue';
import { ErrorCode, isAuthError } from '@/utils/error-codes';
import { classifyError, extractErrorMessage } from '@/utils/api-helpers';
import { formatFileTypeLabel } from '@/utils/display-labels';
import {
  configureChartDefaults,
  formatNumber,
  createAllCharts,
} from '@/composables/useStatsCharts';

configureChartDefaults();

const { addToast } = useToast();
const { authFetch } = useAuth();
const { t } = useI18n();

// --- State ---
const loading = ref(true);
const error = ref('');
const errorCode = ref(null);
const stats = ref(null);

// Chart canvas refs
const trendChartRef = ref(null);
const typeChartRef = ref(null);
const salesTrendChartRef = ref(null);
const topProductsChartRef = ref(null);
const salespersonChartRef = ref(null);
const profitTrendChartRef = ref(null);
const profitByProductChartRef = ref(null);

const largeFilesColumns = computed(() => [
  { key: 'index', label: '#', width: '60px' },
  { key: 'name', label: t('stats.fileName') },
  { key: 'type', label: t('stats.fileType') },
  { key: 'size', label: t('stats.fileSize'), align: 'right' },
]);

const chartRefs = {
  trendChartRef,
  typeChartRef,
  salesTrendChartRef,
  topProductsChartRef,
  salespersonChartRef,
  profitTrendChartRef,
  profitByProductChartRef,
};

const createCharts = () => {
  createAllCharts(stats.value, chartRefs, t);
};

const loadStats = async () => {
  loading.value = true;
  error.value = '';
  errorCode.value = null;
  try {
    const response = await authFetch(API.STATS);
    if (!response.ok) throw new Error('API Request Failed');

    const json = await response.json();
    stats.value = json.data || json;

    await nextTick();
    try {
      setTimeout(createCharts, 100);
    } catch (chartErr) {
      console.warn('Charts failed to render:', chartErr);
    }
  } catch (err) {
    console.error(err);
    const code = classifyError(err);
    errorCode.value = code;
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
  const timer = setInterval(loadStats, 300000);
  onUnmounted(() => clearInterval(timer));
});

onActivated(() => {
  if (!stats.value && !loading.value) {
    loadStats();
  }
});

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
