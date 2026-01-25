<template>
  <div class="relative min-h-screen w-full overflow-hidden bg-gray-50 text-slate-900 dark:bg-slate-900 dark:text-slate-200">
    <!-- Background Gradient Mesh -->
    <div class="pointer-events-none fixed inset-0 z-0">
      <div
        class="absolute -top-[20%] -left-[10%] size-[800px] animate-pulse rounded-full bg-blue-400/20 blur-[120px] dark:bg-blue-600/20"
      ></div>
      <div
        class="absolute top-[20%] right-[0%] size-[600px] animate-pulse rounded-full bg-purple-600/20 blur-[100px]"
        style="animation-delay: 2s"
      ></div>
      <div
        class="absolute -bottom-[20%] left-[20%] size-[600px] animate-pulse rounded-full bg-teal-600/20 blur-[100px]"
        style="animation-delay: 4s"
      ></div>
      <!-- Grid Overlay -->
      <div
        class="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]"
      ></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 px-6 py-8 sm:px-10">
      <!-- Header -->
      <div class="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 class="font-display bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-blue-200 dark:to-indigo-200">
            {{ t('stats.statusOverview') }}
          </h1>
          <p class="mt-2 text-slate-500 dark:text-slate-400">{{ t('ai.subtitle') }}</p>
        </div>
        
        <!-- Refresh Button -->
        <button
          :disabled="loading"
          class="group relative overflow-hidden rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:bg-slate-800/50 dark:text-slate-300 dark:shadow-lg dark:backdrop-blur-md dark:hover:bg-slate-700/50 dark:hover:text-white"
          @click="loadStats"
        >
          <div
            class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          ></div>
          <span class="flex items-center gap-2">
            <svg
              class="size-4"
              :class="{ 'animate-spin': loading }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {{ loading ? t('common.loading') : t('header.refresh') }}
          </span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !stats" class="flex h-96 items-center justify-center">
        <div class="relative">
          <div class="size-16 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="size-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex h-96 flex-col items-center justify-center gap-4 text-center">
        <div class="flex size-20 items-center justify-center rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
          <svg class="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-slate-900 dark:text-slate-200">{{ t('stats.loadFailed') }}</h3>
        <p class="max-w-md text-slate-500">{{ error }}</p>
        <button
          class="mt-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95"
          @click="loadStats"
        >
          {{ t('stats.retry') }}
        </button>
      </div>

      <!-- Dashboard Content -->
      <div v-else-if="stats" class="animate-fade-in-up grid gap-6">
        
        <!-- Key Metrics Row -->
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
            <!-- Total Files -->
           <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-md transition-all hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
             <div class="absolute -top-6 -right-6 rounded-full bg-blue-500/10 p-12 blur-2xl transition-transform group-hover:bg-blue-500/20"></div>
             <div class="relative z-10 flex items-start justify-between">
                <div>
                  <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ t('stats.totalFiles') }}</p>
                  <h3 class="mt-2 font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {{ formatNumber(stats.storage?.totalFiles) }}
                  </h3>
                </div>
                <div class="rounded-lg bg-blue-500/20 p-2 text-blue-400 ring-1 ring-blue-500/30">
                  <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
             </div>
             <!-- Progress Bar Simulation -->
             <div class="mt-4 flex items-center gap-2 text-sm font-medium text-slate-500">
               <span class="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">+{{ formatNumber(stats.storage?.todayUploads) }}</span>
               {{ t('dashboard.todayUploads') }}
             </div>
           </div>

           <!-- Total Storage -->
           <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]">
             <div class="absolute -top-6 -right-6 rounded-full bg-emerald-500/10 p-12 blur-2xl transition-transform group-hover:bg-emerald-500/20"></div>
             <div class="relative z-10 flex items-start justify-between">
                <div>
                  <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ t('stats.totalStorage') }}</p>
                  <h3 class="mt-2 font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {{ formatSize(stats.storage?.totalSize) }}
                  </h3>
                </div>
                <div class="rounded-lg bg-emerald-500/20 p-2 text-emerald-400 ring-1 ring-emerald-500/30">
                  <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
             </div>
             <!-- Progress Bar Simulation -->
              <div class="mt-4 text-sm font-medium text-slate-500">
                {{ t('stats.totalStorage') }}
              </div>
           </div>

           <!-- Monthly Visits -->
           <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]">
             <div class="absolute -top-6 -right-6 rounded-full bg-purple-500/10 p-12 blur-2xl transition-transform group-hover:bg-purple-500/20"></div>
             <div class="relative z-10 flex items-start justify-between">
                <div>
                  <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ t('stats.monthVisits') }}</p>
                  <h3 class="mt-2 font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {{ formatNumber(stats.traffic?.monthTotal) }}
                  </h3>
                </div>
                <div class="rounded-lg bg-purple-500/20 p-2 text-purple-400 ring-1 ring-purple-500/30">
                  <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
             </div>
             <div class="mt-4 text-sm font-medium text-slate-500">
               {{ t('stats.trafficTrend') }}
             </div>
           </div>
        </div>

        <!-- Charts Area -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Traffic Trend -->
          <div class="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-md lg:col-span-2 dark:border-white/10 dark:bg-white/5">
            <h3 class="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <span class="size-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
              {{ t('stats.trafficTrend') }}
            </h3>
            <div class="relative h-80">
              <canvas ref="trendChartRef"></canvas>
            </div>
          </div>

          <!-- File Distribution -->
          <div class="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5">
            <h3 class="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <span class="size-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]"></span>
              {{ t('stats.fileTypes') }}
            </h3>
            <div class="relative h-80">
              <canvas ref="typeChartRef"></canvas>
            </div>
          </div>
        </div>

        <!-- Bottom Grid -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- Top Spaces -->
            <div class="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5">
               <h3 class="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <span class="size-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></span>
                {{ t('stats.topSpaces') }}
              </h3>
              
              <div v-if="stats.traffic?.topSpaces?.length > 0" class="space-y-4">
                <div
                    v-for="(space, index) in stats.traffic?.topSpaces"
                    :key="space.id"
                    class="group flex items-center justify-between rounded-xl border border-transparent bg-gray-50 p-4 transition-all hover:border-blue-100 hover:bg-blue-50/50 dark:bg-white/5 dark:hover:border-white/5 dark:hover:bg-white/10"
                >
                    <div class="flex items-center gap-4">
                        <div 
                          class="flex size-10 items-center justify-center rounded-lg text-lg font-bold"
                           :class="{
                            'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-orange-500/20': index === 0,
                            'bg-slate-700 text-slate-300': index > 0
                          }"
                        >
                            {{ index + 1 }}
                        </div>
                        <div>
                           <div class="font-medium text-white transition-colors group-hover:text-blue-300">{{ space.name }}</div>
                            <div class="mt-1 text-xs text-slate-400">ID: {{ space.id.slice(0,8) }}</div>
                        </div>
                    </div>
                    
                    <div class="text-right">
                         <div class="font-mono text-xl font-bold text-white">{{ formatNumber(space.views) }}</div>
                         <div class="text-xs tracking-wider text-slate-500 uppercase">{{ t('stats.views') }}</div>
                    </div>
                </div>
              </div>
               <div v-else class="flex h-40 items-center justify-center text-slate-500 dark:text-slate-400">
                    {{ t('stats.noData') }}
                </div>
            </div>

            <!-- Health Status -->
            <div class="grid grid-cols-2 gap-4">
                 <div class="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                    <h3 class="mb-6 flex items-center gap-2 text-lg font-semibold text-white">
                        <span class="size-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]"></span>
                        {{ t('stats.statusOverview') }}
                    </h3>
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Normal -->
                        <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 backdrop-blur-sm transition-transform hover:scale-[1.02]">
                            <div class="mb-2 text-sm font-medium text-emerald-400">{{ t('stats.normal') }}</div>
                            <div class="font-mono text-3xl font-bold text-emerald-200">{{ formatNumber(stats.health?.status?.normal) }}</div>
                             <div class="mt-2 h-1 w-full rounded-full bg-emerald-500/20">
                                <div class="h-full rounded-full bg-emerald-500 transition-all duration-1000" style="width: 100%"></div>
                             </div>
                        </div>
                         <!-- Blocked -->
                         <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-5 backdrop-blur-sm transition-transform hover:scale-[1.02]">
                            <div class="mb-2 text-sm font-medium text-red-400">{{ t('stats.blocked') }}</div>
                            <div class="font-mono text-3xl font-bold text-red-200">{{ formatNumber(stats.health?.status?.blocked) }}</div>
                             <div class="mt-2 h-1 w-full rounded-full bg-red-500/20">
                                <div class="h-full rounded-full bg-red-500 transition-all duration-1000" :style="`width: ${stats.health?.status?.blocked > 0 ? '100%' : '0%'}`"></div>
                             </div>
                        </div>
                         <!-- Whitelisted -->
                         <div class="rounded-xl border border-blue-500/20 bg-blue-500/10 p-5 backdrop-blur-sm transition-transform hover:scale-[1.02]">
                            <div class="mb-2 text-sm font-medium text-blue-400">{{ t('stats.whitelisted') }}</div>
                            <div class="font-mono text-3xl font-bold text-blue-200">{{ formatNumber(stats.health?.status?.whitelisted) }}</div>
                        </div>
                        <!-- Liked -->
                        <div class="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-5 backdrop-blur-sm transition-transform hover:scale-[1.02]">
                            <div class="mb-2 text-sm font-medium text-yellow-400">{{ t('stats.liked') }}</div>
                            <div class="font-mono text-3xl font-bold text-yellow-200">{{ formatNumber(stats.health?.status?.liked) }}</div>
                        </div>
                    </div>
                </div>
                
            </div>
        </div>

        <!-- Large Files Table -->
        <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
           <h3 class="mb-6 flex items-center gap-2 text-lg font-semibold text-white">
                <span class="size-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
                {{ t('stats.largeFiles') }}
            </h3>
            
             <div v-if="stats.storage?.largeFiles?.length > 0" class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                  <thead class="border-b border-gray-200 text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <tr>
                      <th class="cursor-default px-4 py-3 font-medium">#</th>
                      <th class="px-4 py-3 font-medium">{{ t('stats.fileName') }}</th>
                      <th class="px-4 py-3 font-medium">{{ t('stats.fileType') }}</th>
                      <th class="px-4 py-3 text-right font-medium">{{ t('stats.fileSize') }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    <tr
                      v-for="(file, index) in stats.storage?.largeFiles"
                      :key="file.id"
                      class="group transition-colors hover:bg-white/5"
                    >
                      <td class="p-4  text-slate-600 group-hover:text-slate-900 dark:text-slate-500 dark:group-hover:text-slate-300">{{ index + 1 }}</td>
                      <td class="p-4  font-medium text-slate-900 dark:text-slate-200">
                          <div class="flex items-center gap-2">
                              <span class="line-clamp-1 max-w-[200px] md:max-w-md">{{ file.name }}</span>
                              <span v-if="index < 3" class="inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-red-400/20 ring-inset">Hot</span>
                          </div>
                      </td>
                      <td class="p-4  text-slate-500 dark:text-slate-400">
                          <span class="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-gray-200 ring-inset dark:bg-slate-700/50 dark:text-slate-300 dark:ring-slate-600/50">
                              {{ file.type?.split('/')[1]?.toUpperCase() || 'UNKNOWN' }}
                          </span>
                      </td>
                      <td class="p-4  text-right font-mono text-orange-400 group-hover:text-orange-300">{{ formatSize(file.size) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
               <div v-else class="flex h-32 items-center justify-center text-slate-500 dark:text-slate-400">
                    {{ t('stats.noData') }}
                </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated, nextTick, onUnmounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { formatSize, getChartColors } from '@/utils/formatters';
import { API } from '@/utils/constants';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

// Configure Chart.js defaults for Dark Mode
Chart.defaults.color = '#94a3b8'; // Slate-400
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

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

  // 1. Traffic Trend Chart
  if (trendChartRef.value) {
    const ctx = trendChartRef.value.getContext('2d');
    const dailyData = stats.value.traffic?.daily || {};

    // Gradient Fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Blue-500
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Object.keys(dailyData),
        datasets: [
          {
            label: t('stats.monthVisits'),
            data: Object.values(dailyData),
            borderColor: '#60a5fa', // Blue-400
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4, // Smooth curve
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)', // Slate-900
                titleColor: '#f8fafc',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
            }
        },
        scales: {
          x: { 
              grid: { display: false }, 
              ticks: { maxTicksLimit: 7, color: '#64748b' } 
          },
          y: {
            border: { display: false },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            beginAtZero: true,
            ticks: { color: '#64748b' }
          },
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
  }

  // 2. File Type Chart
  if (typeChartRef.value) {
    const ctx = typeChartRef.value.getContext('2d');
    const typeData = stats.value.health?.fileTypes?.slice(0, 5) || []; // Start with top 5
    const otherCount = stats.value.health?.fileTypes?.slice(5)?.reduce((acc, cur) => acc + cur.count, 0) || 0;
    if (otherCount > 0) {
        typeData.push({ type: 'Other', count: otherCount });
    }

    typeChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: typeData.map((i) => i.type.toUpperCase().split('/')[1] || i.type),
        datasets: [
          {
            data: typeData.map((i) => i.count),
            backgroundColor: [
                '#3b82f6', // blue
                '#10b981', // emerald
                '#8b5cf6', // violet
                '#f59e0b', // amber
                '#ec4899', // pink
                '#64748b'  // slate (other)
            ],
            borderWidth: 0,
            hoverOffset: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { 
              position: 'right', 
              labels: { 
                  usePointStyle: true, 
                  padding: 20,
                  color: '#cbd5e1', // slate-300
                  font: { size: 12 }
              } 
          },
          tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
          }
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
    stats.value = json.data || json;
    
    // Smooth chart rendering
    await nextTick();
    setTimeout(createCharts, 100); // Slight delay for smoother animation
    
    addToast({ message: t('stats.refreshSuccess'), type: 'success' });
  } catch (err) {
    console.error(err);
    // Don't clear stats if refresh fails, just show error toast
    if (!stats.value) error.value = t('stats.loadError');
    addToast({ message: t('stats.loadError'), type: 'error' });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadStats();
  const timer = setInterval(loadStats, 300000); // 5 min
  onUnmounted(() => clearInterval(timer));
});

onActivated(() => {
  // Optional: check if data is stale
  if (!stats.value) loadStats();
});
</script>

<style scoped>
/* Keyframes available via Tailwind v4 usually, but adding explicit for reliability */
@keyframes fade-in-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
    animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
