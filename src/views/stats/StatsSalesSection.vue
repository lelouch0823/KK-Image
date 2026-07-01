<template>
  <!-- 销售趋势图 (90天) -->
  <StatsChartWrapper :title="t('stats.salesTrend')">
    <template #actions>
      <StatusBadge variant="neutral" outline>
        {{ salesTrendCount }} {{ t('stats.date') }}
      </StatusBadge>
    </template>
    <canvas :ref="setSalesTrendRef"></canvas>
  </StatsChartWrapper>

  <!-- 热销排行 + 销售员业绩 -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <StatsChartWrapper :title="t('stats.topProducts')">
      <canvas :ref="setTopProductsRef"></canvas>
    </StatsChartWrapper>

    <StatsChartWrapper :title="t('stats.salespersonPerformance')">
      <canvas :ref="setSalespersonRef"></canvas>
    </StatsChartWrapper>
  </div>

  <!-- 销售业绩排行榜 -->
  <SalesRanking />
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import StatsChartWrapper from '@/views/stats/StatsChartWrapper.vue';
import SalesRanking from '@/views/stats/SalesRanking.vue';

const props = defineProps({
  stats: { type: Object, required: true },
  setSalesTrendRef: { type: Function, default: null },
  setTopProductsRef: { type: Function, default: null },
  setSalespersonRef: { type: Function, default: null },
});

const { t } = useI18n();

const salesTrendCount = computed(() => props.stats.charts?.salesTrend?.length || 0);
</script>
