<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <StatsChartWrapper class="lg:col-span-2" :title="t('stats.trafficTrend')">
      <canvas :ref="setTrendRef"></canvas>
    </StatsChartWrapper>

    <StatsChartWrapper :title="t('stats.fileTypes')">
      <canvas :ref="setTypeRef"></canvas>
    </StatsChartWrapper>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import StatsChartWrapper from '@/views/stats/StatsChartWrapper.vue';

defineProps({
  setTrendRef: { type: Function, default: null },
  setTypeRef: { type: Function, default: null },
});

const { t } = useI18n();
</script>
