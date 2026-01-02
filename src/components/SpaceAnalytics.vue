<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="text-secondary flex flex-col items-center justify-center py-12">
      <div class="border-primary mb-2 size-8 animate-spin rounded-full border-b-2"></div>
      <p>{{ t('spaceAnalytics.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-[var(--color-danger-bg)]/50 bg-[var(--color-danger-bg)] p-4 text-center text-[var(--color-danger-text)]"
    >
      {{ error }}
    </div>

    <template v-else>
      <!-- Key Metrics -->
      <div class="grid grid-cols-2 gap-4">
        <div
          class="rounded-xl border border-[var(--color-info-bg)]/50 bg-[var(--color-info-bg)] p-4"
        >
          <div class="mb-1 text-sm font-medium text-[var(--color-info-text)]">
            {{ t('spaceAnalytics.totalViews') }}
          </div>
          <div class="text-primary text-2xl font-bold">{{ stats.total?.view_count || 0 }}</div>
        </div>
        <div
          class="rounded-xl border border-[var(--color-purple-bg)]/50 bg-[var(--color-purple-bg)] p-4"
        >
          <div class="mb-1 text-sm font-medium text-[var(--color-purple-text)]">
            {{ t('spaceAnalytics.totalDownloads') }}
          </div>
          <div class="text-primary text-2xl font-bold">{{ stats.total?.download_count || 0 }}</div>
        </div>
      </div>

      <!-- Chart -->
      <div class="rounded-xl border border-[var(--border-color)] bg-white p-4 shadow-sm">
        <h3 class="text-primary mb-4 text-sm font-medium">
          {{ t('spaceAnalytics.visitorTrend') }}
        </h3>
        <div class="h-64">
          <Line v-if="chartData" :data="chartData" :options="chartOptions" />
          <div v-else class="text-secondary flex h-full items-center justify-center text-sm">
            {{ t('spaceAnalytics.noData') }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const props = defineProps({
  spaceId: { type: String, required: true },
});

import { getCssVar, getChartBgColor } from '@/utils/formatters';

const { t } = useI18n();
const loading = ref(true);
const error = ref('');
const stats = ref({});

const chartData = computed(() => {
  if (!stats.value.trend) return null;

  return {
    labels: stats.value.trend.map((d) => d.date.slice(5)), // MM-DD
    datasets: [
      {
        label: t('spaceAnalytics.visits'),
        data: stats.value.trend.map((d) => d.count),
        fill: true,
        borderColor: getCssVar('--color-chart-1'),
        backgroundColor: getChartBgColor(1, 0.1),
        tension: 0.4,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: getCssVar('--color-chart-grid') },
      ticks: { stepSize: 1 },
    },
    x: {
      grid: { display: false },
    },
  },
};

import { API } from '@/utils/constants';

onMounted(async () => {
  try {
    const response = await fetch(API.SPACE_STATS(props.spaceId));
    const result = await response.json();
    if (result.success) {
      stats.value = result.data;
    } else {
      error.value = result.message;
    }
  } catch (_e) {
    error.value = t('spaceAnalytics.loadFailed');
  } finally {
    loading.value = false;
  }
});
</script>
