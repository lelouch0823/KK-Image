<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="h-96 flex flex-col items-center justify-center">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mb-4"></div>
      <span class="text-secondary font-medium">{{ t('stats.analyzing') }}</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="h-96 flex flex-col items-center justify-center text-center">
      <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-primary mb-2">{{ t('stats.loadFailed') }}</h3>
      <p class="text-secondary mb-6">{{ error }}</p>
      <button @click="loadStats" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
        {{ t('stats.retry') }}
      </button>
    </div>

    <!-- Content -->
    <div v-else-if="stats" class="space-y-6 pb-20">
      <!-- Top Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-4 border border-[var(--border-color)] flex flex-col justify-center items-center text-center group hover:border-blue-300 transition-colors">
          <span class="text-secondary text-xs uppercase tracking-wider font-semibold mb-1">{{ t('stats.totalFiles') }}</span>
          <span class="text-3xl font-bold text-primary group-hover:text-blue-600 transition-colors">{{ formatNumber(stats.overview.totalFiles) }}</span>
        </div>
        <div class="bg-white rounded-xl p-4 border border-[var(--border-color)] flex flex-col justify-center items-center text-center group hover:border-green-300 transition-colors">
          <span class="text-secondary text-xs uppercase tracking-wider font-semibold mb-1">{{ t('stats.todayUploads') }}</span>
          <span class="text-3xl font-bold text-primary group-hover:text-green-600 transition-colors">{{ formatNumber(stats.overview.todayUploads) }}</span>
        </div>
        <div class="bg-white rounded-xl p-4 border border-[var(--border-color)] flex flex-col justify-center items-center text-center group hover:border-purple-300 transition-colors">
          <span class="text-secondary text-xs uppercase tracking-wider font-semibold mb-1">{{ t('stats.weekUploads') }}</span>
          <span class="text-3xl font-bold text-primary group-hover:text-purple-600 transition-colors">{{ formatNumber(stats.overview.weekUploads) }}</span>
        </div>
        <div class="bg-white rounded-xl p-4 border border-[var(--border-color)] flex flex-col justify-center items-center text-center group hover:border-orange-300 transition-colors">
          <span class="text-secondary text-xs uppercase tracking-wider font-semibold mb-1">{{ t('stats.totalStorage') }}</span>
          <span class="text-3xl font-bold text-primary group-hover:text-orange-600 transition-colors">{{ formatSize(stats.overview.totalSize) }}</span>
        </div>
      </div>

      <!-- Charts Row 1 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 趋势图 (占用 2/3) -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-[var(--border-color)] p-6">
          <h3 class="text-lg font-semibold text-primary mb-6 flex items-center gap-2">
            <span class="w-1 h-6 bg-blue-500 rounded-full"></span>
            {{ t('stats.uploadTrend') }}
          </h3>
          <div class="relative h-72">
            <canvas ref="trendChartRef"></canvas>
          </div>
        </div>

        <!-- 类型分布 (占用 1/3) -->
        <div class="bg-white rounded-xl border border-[var(--border-color)] p-6">
          <h3 class="text-lg font-semibold text-primary mb-6 flex items-center gap-2">
            <span class="w-1 h-6 bg-green-500 rounded-full"></span>
            {{ t('stats.fileTypes') }}
          </h3>
          <div class="relative h-72 flex items-center justify-center">
            <canvas ref="typeChartRef"></canvas>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 文件状态 -->
        <div class="bg-white rounded-xl border border-[var(--border-color)] p-6">
          <h3 class="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <span class="w-1 h-6 bg-purple-500 rounded-full"></span>
            {{ t('stats.statusOverview') }}
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-gradient-to-br from-green-50 to-emerald-100 p-4 rounded-xl border border-green-100/50">
              <span class="block text-green-600 text-sm font-medium mb-1">{{ t('stats.normal') }}</span>
              <span class="text-2xl font-bold text-green-700">{{ formatNumber(stats.status.normal) }}</span>
            </div>
            <div class="bg-gradient-to-br from-red-50 to-rose-100 p-4 rounded-xl border border-red-100/50">
              <span class="block text-red-600 text-sm font-medium mb-1">{{ t('stats.blocked') }}</span>
              <span class="text-2xl font-bold text-red-700">{{ formatNumber(stats.status.blocked) }}</span>
            </div>
            <div class="bg-gradient-to-br from-blue-50 to-sky-100 p-4 rounded-xl border border-blue-100/50">
              <span class="block text-blue-600 text-sm font-medium mb-1">{{ t('stats.whitelisted') }}</span>
              <span class="text-2xl font-bold text-blue-700">{{ formatNumber(stats.status.whitelisted) }}</span>
            </div>
            <div class="bg-gradient-to-br from-yellow-50 to-amber-100 p-4 rounded-xl border border-yellow-100/50">
              <span class="block text-amber-600 text-sm font-medium mb-1">{{ t('stats.liked') }}</span>
              <span class="text-2xl font-bold text-amber-700">{{ formatNumber(stats.status.liked) }}</span>
            </div>
          </div>
        </div>

        <!-- 最近上传列表 -->
        <div class="bg-white rounded-xl border border-[var(--border-color)] p-6 flex flex-col h-full">
          <h3 class="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <span class="w-1 h-6 bg-orange-500 rounded-full"></span>
            {{ t('stats.recentActivity') }}
          </h3>
          <div class="flex-1 overflow-y-auto scrollbar-thin max-h-[250px] pr-2">
            <div v-for="file in stats.recent" :key="file.name" class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 px-2 rounded-lg transition-colors">
              <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold uppercase shrink-0">
                  {{ file.type.split('/')[1] || 'FILE' }}
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-medium text-primary truncate max-w-[150px] sm:max-w-[200px]" :title="file.name">{{ file.name }}</div>
                  <div class="text-xs text-secondary">{{ formatRelativeDate(file.timestamp) }}</div>
                </div>
              </div>
              <span class="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                {{ formatSize(file.size) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Refresh Button -->
    <button @click="loadStats" class="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40" :class="{ 'animate-spin': loading }" :disabled="loading">
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated, nextTick, onUnmounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { formatSize, getCssVar, getChartColors } from '@/utils/formatters';
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
        datasets: [{
          label: t('stats.dailyUpload'),
          data: Object.values(dailyData),
          borderColor: getCssVar('--color-chart-1'),
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } },
          y: { border: { dash: [4, 4] }, grid: { color: getCssVar('--color-chart-grid') }, beginAtZero: true }
        },
        interaction: { intersect: false, mode: 'index' }
      }
    });
  }

  // New Type Chart
  if (typeChartRef.value) {
    const ctx = typeChartRef.value.getContext('2d');
    const typeData = stats.value.fileTypes.top.slice(0, 6);

    typeChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: typeData.map(i => i.type.toUpperCase()),
        datasets: [{
          data: typeData.map(i => i.count),
          backgroundColor: getChartColors(6),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
        }
      }
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
