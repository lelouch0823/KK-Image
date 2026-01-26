<template>
  <div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- 今日订单 (Indigo) -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-slate-800/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 sm:p-5"
        @click="$emit('filter', 'today')"
      >
        <div class="relative z-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">{{ t('dashboard.todayOrders') }}</div>
            <div class="mt-1 font-[Outfit] text-2xl font-bold tracking-tight text-slate-900 sm:mt-2 sm:text-3xl dark:text-white">
              <span v-if="loading" class="inline-block h-8 w-10 animate-pulse rounded-lg bg-indigo-100 dark:bg-indigo-900/30"></span>
              <span v-else>{{ stats.todayCount }}</span>
            </div>
          </div>
          <div class="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 transition-colors group-hover:bg-indigo-500 group-hover:text-white dark:bg-indigo-500/20 dark:text-indigo-400 dark:group-hover:bg-indigo-500/80 dark:group-hover:text-white sm:size-12">
            <svg class="size-5 transition-transform duration-300 group-hover:scale-110 sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <!-- Blob -->
        <div class="absolute -right-6 -top-6 -z-0 size-32 rounded-full bg-indigo-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-indigo-500/5 opacity-50"></div>
      </div>

      <!-- 待处理 (Amber) -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-slate-800/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 sm:p-5"
        @click="$emit('filter', 'pending')"
      >
        <div class="relative z-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">{{ t('dashboard.pendingOrders') }}</div>
            <div class="mt-1 font-[Outfit] text-2xl font-bold tracking-tight text-slate-900 sm:mt-2 sm:text-3xl dark:text-white">
              <span v-if="loading" class="inline-block h-8 w-10 animate-pulse rounded-lg bg-amber-100 dark:bg-amber-900/30"></span>
              <span v-else>{{ stats.pendingCount }}</span>
            </div>
          </div>
          <div class="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-white dark:bg-amber-500/20 dark:text-amber-400 dark:group-hover:bg-amber-500/80 dark:group-hover:text-white sm:size-12">
            <svg class="size-5 transition-transform duration-300 group-hover:scale-110 sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div class="absolute -right-6 -top-6 -z-0 size-32 rounded-full bg-amber-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-amber-500/5 opacity-50"></div>
      </div>

      <!-- 本周订单 (Emerald) -->
      <div
        class="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-slate-800/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 sm:p-5"
      >
        <div class="relative z-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">{{ t('order.dashboard.weekOrders') }}</div>
            <div class="mt-1 font-[Outfit] text-2xl font-bold tracking-tight text-slate-900 sm:mt-2 sm:text-3xl dark:text-white">
              <span v-if="loading" class="inline-block h-8 w-10 animate-pulse rounded-lg bg-emerald-100 dark:bg-emerald-900/30"></span>
              <span v-else>{{ stats.weekCount }}</span>
            </div>
          </div>
          <div class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white dark:bg-emerald-500/20 dark:text-emerald-400 dark:group-hover:bg-emerald-500/80 dark:group-hover:text-white sm:size-12">
            <svg class="size-5 transition-transform duration-300 group-hover:scale-110 sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
        <div class="absolute -right-6 -top-6 -z-0 size-32 rounded-full bg-emerald-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-emerald-500/5 opacity-50"></div>
      </div>

      <!-- 状态分布 (Purple) -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-slate-800/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10 sm:p-5"
        @click="showChartModal = true"
      >
        <div class="relative z-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">{{ t('order.dashboard.statusDistribution') }}</div>
            <div v-if="!loading" class="mt-2 flex flex-col gap-1 sm:mt-2.5 sm:flex-row sm:items-center sm:gap-2.5">
              <span class="inline-flex items-center gap-1.5 text-[10px] font-medium sm:text-xs text-slate-700 dark:text-slate-300">
                <span class="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 sm:size-2.5"></span>
                {{ stats.statusDistribution?.confirmed || 0 }}
              </span>
              <span class="inline-flex items-center gap-1.5 text-[10px] font-medium sm:text-xs text-slate-700 dark:text-slate-300">
                <span class="size-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20 sm:size-2.5"></span>
                {{ stats.statusDistribution?.pending || 0 }}
              </span>
              <span class="inline-flex items-center gap-1.5 text-[10px] font-medium sm:text-xs text-slate-700 dark:text-slate-300">
                <span class="size-2 rounded-full bg-red-500 ring-2 ring-red-500/20 sm:size-2.5"></span>
                {{ stats.statusDistribution?.rejected || 0 }}
              </span>
            </div>
            <div v-else class="mt-2 flex h-6 items-center">
              <span class="inline-block h-5 w-24 animate-pulse rounded-lg bg-purple-100 dark:bg-purple-900/30"></span>
            </div>
          </div>
          <div class="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 transition-colors group-hover:bg-purple-500 group-hover:text-white dark:bg-purple-500/20 dark:text-purple-400 dark:group-hover:bg-purple-500/80 dark:group-hover:text-white sm:size-12">
            <svg class="size-5 transition-transform duration-300 group-hover:scale-110 sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
        </div>
        <div class="absolute -right-6 -top-6 -z-0 size-32 rounded-full bg-purple-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 dark:bg-purple-500/5 opacity-50"></div>
      </div>
    </div>
  </div>

  <!-- 状态分布图表弹窗 -->
  <StatusChartModal v-model="showChartModal" :distribution="stats.statusDistribution" />
</template>

<script setup>
import { ref, onMounted, onActivated } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import StatusChartModal from './StatusChartModal.vue';

defineProps({});

defineEmits(['filter']);

const { t } = useI18n();

const loading = ref(true);
const showChartModal = ref(false);
const stats = ref({
  todayCount: 0,
  pendingCount: 0,
  weekCount: 0,
  statusDistribution: {},
});

const loadStats = async () => {
  loading.value = true;
  try {
    const res = await fetch(API.MANAGE_DASHBOARD_STATS, { credentials: 'include' });
    const result = await res.json();
    if (result.success) {
      stats.value = result.data;
    }
  } catch (e) {
    console.warn('Failed to load order stats:', e);
  } finally {
    loading.value = false;
  }
};

onMounted(loadStats);

// 每次模块可见时刷新数据
onActivated(loadStats);
</script>

<style scoped>
/* 隐藏横向滚动条 */
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}

/* 折叠动画 */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease-out;
  overflow: hidden;
}
.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}
.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 100px;
}
</style>
