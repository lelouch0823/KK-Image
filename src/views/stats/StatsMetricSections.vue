<template>
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
      <canvas :ref="setProfitTrendRef"></canvas>
    </StatsChartWrapper>

    <StatsChartWrapper :title="t('stats.profitByProduct')">
      <canvas :ref="setProfitByProductRef"></canvas>
    </StatsChartWrapper>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { formatSize, formatCurrencyCompact } from '@/utils/formatters';
import { formatNumber } from '@/composables/useStatsCharts';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import StatGroup from '@/design-system/composed/StatGroup.vue';
import SurfaceSection from '@/design-system/composed/SurfaceSection.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import StatsChartWrapper from '@/views/stats/StatsChartWrapper.vue';

defineProps({
  stats: { type: Object, required: true },
  setProfitTrendRef: { type: Function, default: null },
  setProfitByProductRef: { type: Function, default: null },
});

const { t } = useI18n();
</script>
