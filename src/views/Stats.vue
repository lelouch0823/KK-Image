<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="flex h-96 flex-col items-center justify-center">
      <div class="mb-4 size-10 animate-spin rounded-full border-b-2 border-indigo-500"></div>
      <span class="text-secondary font-medium">{{ t('stats.analyzing') }}</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex h-96 flex-col items-center justify-center text-center">
      <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-red-50">
        <svg class="size-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 class="text-primary mb-2 text-lg font-medium">{{ t('stats.loadFailed') }}</h3>
      <p class="text-secondary mb-6">{{ error }}</p>
      <button
        class="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
        @click="loadStats"
      >
        {{ t('stats.retry') }}
      </button>
    </div>

    <!-- Content -->
    <div v-else-if="stats" class="space-y-6 pb-20">
      <!-- Top Stats Cards -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div
          class="group flex flex-col items-center justify-center rounded-xl border border-[var(--border-color)] bg-white p-4 text-center transition-colors hover:border-blue-300"
        >
          <span class="text-secondary mb-1 text-xs font-semibold tracking-wider uppercase">{{
            t('stats.totalFiles')
          }}</span>
          <span
            class="text-primary text-3xl font-bold transition-colors group-hover:text-blue-600"
            >{{ formatNumber(stats.overview.totalFiles) }}</span
          >
        </div>
        <div
          class="group flex flex-col items-center justify-center rounded-xl border border-[var(--border-color)] bg-white p-4 text-center transition-colors hover:border-green-300"
        >
          <span class="text-secondary mb-1 text-xs font-semibold tracking-wider uppercase">{{
            t('stats.todayUploads')
          }}</span>
          <span
            class="text-primary text-3xl font-bold transition-colors group-hover:text-green-600"
            >{{ formatNumber(stats.overview.todayUploads) }}</span
          >
        </div>
        <div
          class="group flex flex-col items-center justify-center rounded-xl border border-[var(--border-color)] bg-white p-4 text-center transition-colors hover:border-purple-300"
        >
          <span class="text-secondary mb-1 text-xs font-semibold tracking-wider uppercase">{{
            t('stats.weekUploads')
          }}</span>
          <span
            class="text-primary text-3xl font-bold transition-colors group-hover:text-purple-600"
            >{{ formatNumber(stats.overview.weekUploads) }}</span
          >
        </div>
        <div
          class="group flex flex-col items-center justify-center rounded-xl border border-[var(--border-color)] bg-white p-4 text-center transition-colors hover:border-orange-300"
        >
          <span class="text-secondary mb-1 text-xs font-semibold tracking-wider uppercase">{{
            t('stats.totalStorage')
          }}</span>
          <span
            class="text-primary text-3xl font-bold transition-colors group-hover:text-orange-600"
            >{{ formatSize(stats.overview.totalSize) }}</span
          >
        </div>
      </div>

      <!-- Charts Row 1 -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- 趋势图 (占用 2/3) -->
        <div class="rounded-xl border border-[var(--border-color)] bg-white p-6 lg:col-span-2">
          <h3 class="text-primary mb-6 flex items-center gap-2 text-lg font-semibold">
            <span class="h-6 w-1 rounded-full bg-blue-500"></span>
            {{ t('stats.uploadTrend') }}
          </h3>
          <div class="relative h-72">
            <canvas ref="trendChartRef"></canvas>
          </div>
        </div>

        <!-- 类型分布 (占用 1/3) -->
        <div class="rounded-xl border border-[var(--border-color)] bg-white p-6">
          <h3 class="text-primary mb-6 flex items-center gap-2 text-lg font-semibold">
            <span class="h-6 w-1 rounded-full bg-green-500"></span>
            {{ t('stats.fileTypes') }}
          </h3>
          <div class="relative flex h-72 items-center justify-center">
            <canvas ref="typeChartRef"></canvas>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- 文件状态 -->
        <div class="rounded-xl border border-[var(--border-color)] bg-white p-6">
          <h3 class="text-primary mb-4 flex items-center gap-2 text-lg font-semibold">
            <span class="h-6 w-1 rounded-full bg-purple-500"></span>
            {{ t('stats.statusOverview') }}
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div
              class="rounded-xl border border-green-100/50 bg-gradient-to-br from-green-50 to-emerald-100 p-4"
            >
              <span class="mb-1 block text-sm font-medium text-green-600">{{
                t('stats.normal')
              }}</span>
              <span class="text-2xl font-bold text-green-700">{{
                formatNumber(stats.status.normal)
              }}</span>
            </div>
            <div
              class="rounded-xl border border-red-100/50 bg-gradient-to-br from-red-50 to-rose-100 p-4"
            >
              <span class="mb-1 block text-sm font-medium text-red-600">{{
                t('stats.blocked')
              }}</span>
              <span class="text-2xl font-bold text-red-700">{{
                formatNumber(stats.status.blocked)
              }}</span>
            </div>
            <div
              class="rounded-xl border border-blue-100/50 bg-gradient-to-br from-blue-50 to-sky-100 p-4"
            >
              <span class="mb-1 block text-sm font-medium text-blue-600">{{
                t('stats.whitelisted')
              }}</span>
              <span class="text-2xl font-bold text-blue-700">{{
                formatNumber(stats.status.whitelisted)
              }}</span>
            </div>
            <div
              class="rounded-xl border border-yellow-100/50 bg-gradient-to-br from-yellow-50 to-amber-100 p-4"
            >
              <span class="mb-1 block text-sm font-medium text-amber-600">{{
                t('stats.liked')
              }}</span>
              <span class="text-2xl font-bold text-amber-700">{{
                formatNumber(stats.status.liked)
              }}</span>
            </div>
          </div>
        </div>

        <!-- 最近上传列表 -->
        <div
          class="flex h-full flex-col rounded-xl border border-[var(--border-color)] bg-white p-6"
        >
          <h3 class="text-primary mb-4 flex items-center gap-2 text-lg font-semibold">
            <span class="h-6 w-1 rounded-full bg-orange-500"></span>
            {{ t('stats.recentActivity') }}
          </h3>
          <div class="scrollbar-thin max-h-[250px] flex-1 overflow-y-auto pr-2">
            <div
              v-for="file in stats.recent"
              :key="file.name"
              class="flex items-center justify-between rounded-lg border-b border-gray-100 px-2 py-3 transition-colors last:border-0 hover:bg-gray-50"
            >
              <div class="flex items-center gap-3 overflow-hidden">
                <div
                  class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-400 uppercase"
                >
                  {{ file.type.split('/')[1] || 'FILE' }}
                </div>
                <div class="min-w-0">
                  <div
                    class="text-primary max-w-[150px] truncate text-sm font-medium sm:max-w-[200px]"
                    :title="file.name"
                  >
                    {{ file.name }}
                  </div>
                  <div class="text-secondary text-xs">{{ formatRelativeDate(file.timestamp) }}</div>
                </div>
              </div>
              <span
                class="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium whitespace-nowrap text-gray-400"
              >
                {{ formatSize(file.size) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Refresh Button -->
    <button
      class="fixed right-4 bottom-20 z-40 flex size-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition-all hover:scale-110 active:scale-95 lg:right-6 lg:bottom-6 lg:size-14"
      :class="{ 'animate-spin': loading }"
      :disabled="loading"
      @click="loadStats"
    >
      <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated, nextTick, onUnmounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { formatSize, getCssVar, getChartColors, formatRelativeTime } from '@/utils/formatters';
import { API } from '@/utils/constants';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

const { addToast } = useToast();
const { authFetch } = useAuth();
const { t } = useI18n();

// --- State ---
const loading = ref(true);
const error = ref('');
const stats = ref(null);
const trendChartRef = ref(null);
const typeChartRef = ref(null);

let trendChartInstance = null;
let typeChartInstance = null;

// 格式化数字
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
};

// 格式化相对时间 (已迁移至 utils/formatters，这里保持调用)
const formatRelativeDate = (timestamp) => {
  return formatRelativeTime(timestamp, t);
};

const createCharts = () => {
  if (!stats.value) return;

  // Destroy Old
  if (trendChartInstance) trendChartInstance.destroy();
  if (typeChartInstance) typeChartInstance.destroy();

  // New Trend Chart
  if (trendChartRef.value) {
    const ctx = trendChartRef.value.getContext('2d');
    const dailyData = stats.value.trends.daily;

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(64, 158, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(64, 158, 255, 0)');

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Object.keys(dailyData),
        datasets: [
          {
            label: t('stats.dailyUpload'),
            data: Object.values(dailyData),
            borderColor: getCssVar('--color-chart-1'),
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } },
          y: {
            border: { dash: [4, 4] },
            grid: { color: getCssVar('--color-chart-grid') },
            beginAtZero: true,
          },
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
  }

  // New Type Chart
  if (typeChartRef.value) {
    const ctx = typeChartRef.value.getContext('2d');
    const typeData = stats.value.fileTypes.top.slice(0, 6);

    typeChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: typeData.map((i) => i.type.toUpperCase()),
        datasets: [
          {
            data: typeData.map((i) => i.count),
            backgroundColor: getChartColors(6),
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
        },
      },
    });
  }
};

const loadStats = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await authFetch(API.STATS);
    if (!response.ok) throw new Error('API Request Failed');

    stats.value = await response.json();
    await nextTick();
    createCharts();
    addToast({ message: t('stats.refreshSuccess'), type: 'success' });
  } catch (err) {
    console.error(err);
    if (!stats.value) error.value = t('stats.loadError');
    addToast({ message: t('stats.loadError'), type: 'error' });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadStats();
  // Auto refresh
  const timer = setInterval(loadStats, 300000); // 5 min
  onUnmounted(() => clearInterval(timer));
});

onActivated(() => {
  loadStats();
});
</script>
