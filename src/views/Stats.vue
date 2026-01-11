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
      <!-- Top Stats Cards (SOTA: 存储 + 访问) -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div
          class="group flex flex-col items-center justify-center rounded-2xl border border-[var(--border-color)] bg-white p-4 text-center transition-all duration-300 hover:shadow-soft hover:-translate-y-1 hover:border-blue-300"
        >
          <span class="text-secondary mb-1 text-xs font-semibold tracking-wider uppercase">{{
            t('stats.totalFiles')
          }}</span>
          <span
            class="text-primary text-3xl font-bold transition-colors group-hover:text-blue-600"
            >{{ formatNumber(stats.storage.totalFiles) }}</span
          >
        </div>
        <div
          class="group flex flex-col items-center justify-center rounded-2xl border border-[var(--border-color)] bg-white p-4 text-center transition-all duration-300 hover:shadow-soft hover:-translate-y-1 hover:border-green-300"
        >
          <span class="text-secondary mb-1 text-xs font-semibold tracking-wider uppercase">{{
            t('stats.totalStorage')
          }}</span>
          <span
            class="text-primary text-3xl font-bold transition-colors group-hover:text-green-600"
            >{{ formatSize(stats.storage.totalSize) }}</span
          >
        </div>
        <div
          class="group flex flex-col items-center justify-center rounded-2xl border border-[var(--border-color)] bg-white p-4 text-center transition-all duration-300 hover:shadow-soft hover:-translate-y-1 hover:border-purple-300"
        >
          <span class="text-secondary mb-1 text-xs font-semibold tracking-wider uppercase">{{
            t('stats.monthVisits')
          }}</span>
          <span
            class="text-primary text-3xl font-bold transition-colors group-hover:text-purple-600"
            >{{ formatNumber(stats.traffic.monthTotal) }}</span
          >
        </div>
      </div>

      <!-- Charts Row 1: 访问趋势 + 文件类型 -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- 访问趋势图 (占用 2/3) -->
        <div class="rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-sm lg:col-span-2">
          <h3 class="text-primary mb-6 flex items-center gap-2 text-lg font-semibold">
            <span class="h-6 w-1 rounded-full bg-blue-500"></span>
            {{ t('stats.trafficTrend') }}
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

      <!-- Bottom Row: 热门空间 + 资产健康度 -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- 热门空间 Top 5 -->
        <div class="rounded-xl border border-[var(--border-color)] bg-white p-6">
          <h3 class="text-primary mb-4 flex items-center gap-2 text-lg font-semibold">
            <span class="h-6 w-1 rounded-full bg-orange-500"></span>
            {{ t('stats.topSpaces') }}
          </h3>
          <div v-if="stats.traffic.topSpaces.length > 0" class="space-y-3">
            <div
              v-for="(space, index) in stats.traffic.topSpaces"
              :key="space.id"
              class="flex items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100"
            >
              <div class="flex items-center gap-3">
                <span
                  class="flex size-8 items-center justify-center rounded-full text-sm font-bold"
                  :class="{
                    'bg-yellow-100 text-yellow-700': index === 0,
                    'bg-gray-200 text-gray-600': index === 1,
                    'bg-orange-100 text-orange-600': index === 2,
                    'bg-gray-100 text-gray-500': index > 2
                  }"
                >
                  {{ index + 1 }}
                </span>
                <span class="text-primary max-w-[200px] truncate font-medium">{{ space.name }}</span>
              </div>
              <div class="text-secondary text-sm">
                {{ formatNumber(space.views) }} {{ t('stats.views') }}
              </div>
            </div>
          </div>
          <div v-else class="text-secondary flex h-40 items-center justify-center text-sm">
            {{ t('stats.noData') }}
          </div>
        </div>

        <!-- 资产健康度 -->
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
                formatNumber(stats.health.status.normal)
              }}</span>
            </div>
            <div
              class="rounded-xl border border-red-100/50 bg-gradient-to-br from-red-50 to-rose-100 p-4"
            >
              <span class="mb-1 block text-sm font-medium text-red-600">{{
                t('stats.blocked')
              }}</span>
              <span class="text-2xl font-bold text-red-700">{{
                formatNumber(stats.health.status.blocked)
              }}</span>
            </div>
            <div
              class="rounded-xl border border-blue-100/50 bg-gradient-to-br from-blue-50 to-sky-100 p-4"
            >
              <span class="mb-1 block text-sm font-medium text-blue-600">{{
                t('stats.whitelisted')
              }}</span>
              <span class="text-2xl font-bold text-blue-700">{{
                formatNumber(stats.health.status.whitelisted)
              }}</span>
            </div>
            <div
              class="rounded-xl border border-yellow-100/50 bg-gradient-to-br from-yellow-50 to-amber-100 p-4"
            >
              <span class="mb-1 block text-sm font-medium text-amber-600">{{
                t('stats.liked')
              }}</span>
              <span class="text-2xl font-bold text-amber-700">{{
                formatNumber(stats.health.status.liked)
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 大文件 Top 10 -->
      <div class="rounded-xl border border-[var(--border-color)] bg-white p-6">
        <h3 class="text-primary mb-4 flex items-center gap-2 text-lg font-semibold">
          <span class="h-6 w-1 rounded-full bg-red-500"></span>
          {{ t('stats.largeFiles') }}
        </h3>
        <div v-if="stats.storage.largeFiles.length > 0" class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-secondary border-b border-[var(--border-color)] bg-gray-50">
              <tr>
                <th class="px-4 py-3">#</th>
                <th class="px-4 py-3">{{ t('stats.fileName') }}</th>
                <th class="px-4 py-3">{{ t('stats.fileType') }}</th>
                <th class="px-4 py-3 text-right">{{ t('stats.fileSize') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-color)]">
              <tr
                v-for="(file, index) in stats.storage.largeFiles"
                :key="file.id"
                class="hover:bg-gray-50"
              >
                <td class="px-4 py-3 text-gray-400">{{ index + 1 }}</td>
                <td class="text-primary max-w-[300px] truncate px-4 py-3 font-medium">{{ file.name }}</td>
                <td class="text-secondary px-4 py-3">{{ file.type?.split('/')[1] || '-' }}</td>
                <td class="px-4 py-3 text-right font-mono text-orange-600">{{ formatSize(file.size) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-secondary flex h-20 items-center justify-center text-sm">
          {{ t('stats.noData') }}
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

const createCharts = () => {
  if (!stats.value) return;

  // Destroy Old
  if (trendChartInstance) trendChartInstance.destroy();
  if (typeChartInstance) typeChartInstance.destroy();

  // New Trend Chart (访问趋势)
  if (trendChartRef.value) {
    const ctx = trendChartRef.value.getContext('2d');
    const dailyData = stats.value.traffic.daily;

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Object.keys(dailyData),
        datasets: [
          {
            label: t('stats.monthVisits'),
            data: Object.values(dailyData),
            borderColor: getCssVar('--color-chart-1') || '#6366f1',
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
            grid: { color: getCssVar('--color-chart-grid') || '#e5e7eb' },
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
    const typeData = stats.value.health.fileTypes.slice(0, 6);

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

    const json = await response.json();
    // API 返回 { success: true, data: {...} } 格式
    stats.value = json.data || json;
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
