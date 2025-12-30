<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-12 text-secondary">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
      <p>{{ t('spaceAnalytics.loading') }}</p>
    </div>

    <div v-else-if="error" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-bg)]/50 text-[var(--color-danger-text)] p-4 rounded-lg text-center">
       {{ error }}
    </div>

    <template v-else>
      <!-- Key Metrics -->
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-[var(--color-info-bg)] p-4 rounded-xl border border-[var(--color-info-bg)]/50">
          <div class="text-sm text-[var(--color-info-text)] font-medium mb-1">{{ t('spaceAnalytics.totalViews') }}</div>
          <div class="text-2xl font-bold text-primary">{{ stats.total?.view_count || 0 }}</div>
        </div>
        <div class="bg-[var(--color-purple-bg)] p-4 rounded-xl border border-[var(--color-purple-bg)]/50">
          <div class="text-sm text-[var(--color-purple-text)] font-medium mb-1">{{ t('spaceAnalytics.totalDownloads') }}</div>
          <div class="text-2xl font-bold text-primary">{{ stats.total?.download_count || 0 }}</div>
        </div>
      </div>

      <!-- Chart -->
      <div class="bg-white border border-[var(--border-color)] rounded-xl p-4 shadow-sm">
        <h3 class="text-sm font-medium text-primary mb-4">{{ t('spaceAnalytics.visitorTrend') }}</h3>
        <div class="h-64">
           <Line v-if="chartData" :data="chartData" :options="chartOptions" />
           <div v-else class="h-full flex items-center justify-center text-secondary text-sm">{{ t('spaceAnalytics.noData') }}</div>
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
  Filler
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
  spaceId: { type: String, required: true }
});

import { getCssVar, getChartBgColor } from '@/utils/formatters';

const { t } = useI18n();
const loading = ref(true);
const error = ref('');
const stats = ref({});

const chartData = computed(() => {
    if (!stats.value.trend) return null;
    
    return {
        labels: stats.value.trend.map(d => d.date.slice(5)), // MM-DD
        datasets: [{
            label: t('spaceAnalytics.visits'),
            data: stats.value.trend.map(d => d.count),
            fill: true,
            borderColor: getCssVar('--color-chart-1'),
            backgroundColor: getChartBgColor(1, 0.1),
            tension: 0.4
        }]
    };
});

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false }
    },
    scales: {
        y: {
            beginAtZero: true,
            grid: { color: getCssVar('--color-chart-grid') },
            ticks: { stepSize: 1 }
        },
        x: {
            grid: { display: false }
        }
    }
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
    } catch (e) {
        error.value = t('spaceAnalytics.loadFailed');
    } finally {
        loading.value = false;
    }
});
</script>
