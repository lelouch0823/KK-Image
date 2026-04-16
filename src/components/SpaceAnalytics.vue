<template>
  <div class="space-y-6">
    <!-- Loading State with Skeleton -->
    <template v-if="loading">
      <div class="grid grid-cols-2 gap-4">
        <div
          class="animate-pulse rounded-xl border border-(--border-color) bg-(--bg-muted) p-4"
        >
          <div class="mb-2 h-4 w-16 rounded bg-(--border-color)"></div>
          <div class="h-8 w-24 rounded bg-(--border-color)"></div>
        </div>
        <div
          class="animate-pulse rounded-xl border border-(--border-color) bg-(--bg-muted) p-4"
        >
          <div class="mb-2 h-4 w-16 rounded bg-(--border-color)"></div>
          <div class="h-8 w-24 rounded bg-(--border-color)"></div>
        </div>
      </div>
      <div
        class="animate-pulse rounded-xl border border-(--border-color) bg-(--bg-muted) p-4"
      >
        <div class="mb-4 h-4 w-32 rounded bg-(--border-color)"></div>
        <div class="h-64 rounded bg-(--border-color)"></div>
      </div>
    </template>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="rounded-lg border border-(--color-danger-bg)/50 bg-(--color-danger-bg) p-4 text-center text-(--color-danger-text)"
    >
      {{ error }}
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Key Metrics -->
      <div class="grid grid-cols-2 gap-4">
        <AppStatCard
          :label="t('spaceAnalytics.totalViews')"
          :value="stats.total?.view_count || 0"
          variant="info"
        />
        <AppStatCard
          :label="t('spaceAnalytics.totalDownloads')"
          :value="stats.total?.download_count || 0"
          variant="purple"
        />
      </div>

      <!-- Chart with Time Range Selector -->
      <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-medium text-(--text-main)">
            {{ t('spaceAnalytics.visitorTrend') }}
          </h3>
          <!-- Time Range Toggle -->
          <div
            class="flex rounded-lg border border-(--border-color) bg-(--bg-muted) p-0.5"
          >
            <AppButton
              variant="ghost"
              size="sm"
              :class="[
                'rounded-md !h-auto !px-3 !py-1 text-xs font-medium transition-all duration-200',
                selectedDays === 7
                  ? 'text-primary bg-(--bg-card) shadow-sm'
                  : 'text-(--text-secondary) hover:text-(--text-main)',
              ]"
              @click="changeDays(7)"
            >
              {{ t('spaceAnalytics.days7') }}
            </AppButton>
            <AppButton
              variant="ghost"
              size="sm"
              :class="[
                'rounded-md !h-auto !px-3 !py-1 text-xs font-medium transition-all duration-200',
                selectedDays === 30
                  ? 'text-primary bg-(--bg-card) shadow-sm'
                  : 'text-(--text-secondary) hover:text-(--text-main)',
              ]"
              @click="changeDays(30)"
            >
              {{ t('spaceAnalytics.days30') }}
            </AppButton>
          </div>
        </div>

        <div class="relative h-64">
          <!-- Chart Loading Overlay -->
          <div
            v-if="chartLoading"
            class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-(--bg-card)/80"
          >
            <div class="border-primary size-6 animate-spin rounded-full border-b-2"></div>
          </div>

          <!-- Chart or Empty State -->
          <Transition name="fade" mode="out-in">
            <Line
              v-if="chartData && hasVisits"
              :key="selectedDays"
              :data="chartData"
              :options="chartOptions"
            />
            <div
              v-else
              class="flex h-full flex-col items-center justify-center text-center"
            >
              <!-- Empty State Icon -->
              <svg
                class="mb-3 size-12 text-(--text-secondary) opacity-40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p class="text-sm text-(--text-secondary)">{{ t('spaceAnalytics.noVisits') }}</p>
              <p class="mt-1 text-xs text-(--text-muted)">{{ t('spaceAnalytics.noVisitsHint') }}</p>
            </div>
          </Transition>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppStatCard from '@/components/ui/AppStatCard.vue';
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
import { getCssVar, getChartBgColor } from '@/utils/formatters';
import { API } from '@/utils/constants';

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

const { t } = useI18n();
const loading = ref(true);
const chartLoading = ref(false);
const error = ref('');
const stats = ref({});
const selectedDays = ref(7);

// 检查是否有任何访问数据
const hasVisits = computed(() => {
  if (!stats.value.trend) return false;
  return stats.value.trend.some((d) => d.count > 0);
});

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
        pointRadius: selectedDays.value === 30 ? 2 : 4,
        pointHoverRadius: 6,
      },
    ],
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 400,
    easing: 'easeOutQuart',
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      cornerRadius: 8,
      titleFont: { size: 12 },
      bodyFont: { size: 14, weight: 'bold' },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: getCssVar('--color-chart-grid') },
      ticks: { stepSize: 1 },
    },
    x: {
      grid: { display: false },
      ticks: {
        maxTicksLimit: selectedDays.value === 30 ? 10 : 7,
      },
    },
  },
}));

const fetchStats = async (days = 7) => {
  try {
    const url = `${API.SPACE_STATS(props.spaceId)}?days=${days}`;
    const response = await fetch(url);
    const result = await response.json();
    if (result.success) {
      stats.value = result.data;
    } else {
      error.value = result.message;
    }
  } catch (_e) {
    error.value = t('spaceAnalytics.loadFailed');
  }
};

const changeDays = async (days) => {
  if (days === selectedDays.value) return;
  selectedDays.value = days;
  chartLoading.value = true;
  await fetchStats(days);
  chartLoading.value = false;
};

// Watch for spaceId changes (when switching spaces)
watch(
  () => props.spaceId,
  async (newId) => {
    if (newId) {
      loading.value = true;
      error.value = '';
      await fetchStats(selectedDays.value);
      loading.value = false;
    }
  }
);

onMounted(async () => {
  await fetchStats(selectedDays.value);
  loading.value = false;
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
