<template>
  <div>
    <div class="grid grid-cols-2 gap-3 sm:gap-4">
      <!-- 今日订单 (Info/Primary) -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--color-info)]/10 hover:shadow-xl sm:p-5"
        @click="$emit('filter', 'today')"
      >
        <!-- 右上角图标 -->
        <div class="absolute top-3 right-3 flex size-9 items-center justify-center rounded-xl bg-[var(--color-info)]/10 text-[var(--color-info)] transition-colors group-hover:bg-[var(--color-info)] group-hover:text-[var(--text-inverse)] sm:top-4 sm:right-4 sm:size-10">
          <svg class="size-4.5 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <!-- 内容 -->
        <div class="relative z-10">
          <div class="text-xs font-medium whitespace-nowrap text-[var(--text-secondary)] sm:text-sm">{{ t('dashboard.todayOrders') }}</div>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-[var(--text-main)] sm:mt-3 sm:text-4xl">
            <span v-if="loading" class="inline-block h-9 w-12 animate-pulse rounded-lg bg-[var(--color-info)]/10"></span>
            <span v-else>{{ stats.todayCount }}</span>
          </div>
        </div>
        <!-- Blob -->
        <div class="absolute -bottom-8 -right-8 -z-0 size-28 rounded-full bg-[var(--color-info)]/8 opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
      </div>

      <!-- 待处理 (Warning) -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--color-warning)]/10 hover:shadow-xl sm:p-5"
        @click="$emit('filter', 'pending')"
      >
        <div class="absolute top-3 right-3 flex size-9 items-center justify-center rounded-xl bg-[var(--color-warning)]/10 text-[var(--color-warning)] transition-colors group-hover:bg-[var(--color-warning)] group-hover:text-[var(--text-inverse)] sm:top-4 sm:right-4 sm:size-10">
          <svg class="size-4.5 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="relative z-10">
          <div class="text-xs font-medium whitespace-nowrap text-[var(--text-secondary)] sm:text-sm">{{ t('dashboard.pendingOrders') }}</div>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-[var(--text-main)] sm:mt-3 sm:text-4xl">
            <span v-if="loading" class="inline-block h-9 w-12 animate-pulse rounded-lg bg-[var(--color-warning)]/10"></span>
            <span v-else>{{ stats.pendingCount }}</span>
          </div>
        </div>
        <div class="absolute -bottom-8 -right-8 -z-0 size-28 rounded-full bg-[var(--color-warning)]/8 opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
      </div>

      <!-- 本周订单 (Success) -->
      <div
        class="group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--color-success)]/10 hover:shadow-xl sm:p-5"
      >
        <div class="absolute top-3 right-3 flex size-9 items-center justify-center rounded-xl bg-[var(--color-success)]/10 text-[var(--color-success)] transition-colors group-hover:bg-[var(--color-success)] group-hover:text-[var(--text-inverse)] sm:top-4 sm:right-4 sm:size-10">
          <svg class="size-4.5 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div class="relative z-10">
          <div class="text-xs font-medium whitespace-nowrap text-[var(--text-secondary)] sm:text-sm">{{ t('order.dashboard.weekOrders') }}</div>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-[var(--text-main)] sm:mt-3 sm:text-4xl">
            <span v-if="loading" class="inline-block h-9 w-12 animate-pulse rounded-lg bg-[var(--color-success)]/10"></span>
            <span v-else>{{ stats.weekCount }}</span>
          </div>
        </div>
        <div class="absolute -bottom-8 -right-8 -z-0 size-28 rounded-full bg-[var(--color-success)]/8 opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
      </div>

      <!-- 状态分布 (Primary/Purple) -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--color-primary)]/10 hover:shadow-xl sm:p-5"
        @click="showChartModal = true"
      >
        <div class="absolute top-3 right-3 flex size-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-colors group-hover:bg-[var(--color-primary)] group-hover:text-[var(--text-inverse)] sm:top-4 sm:right-4 sm:size-10">
          <svg class="size-4.5 transition-transform duration-300 group-hover:scale-110 sm:size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9 0 0120.488 9z" />
          </svg>
        </div>
        <div class="relative z-10">
          <div class="text-xs font-medium whitespace-nowrap text-[var(--text-secondary)] sm:text-sm">{{ t('order.dashboard.statusDistribution') }}</div>
          <div v-if="!loading" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:mt-3">
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]">
              <span class="size-2.5 rounded-full bg-[var(--color-success)] ring-2 ring-[var(--color-success)]/20"></span>
              {{ stats.statusDistribution?.confirmed || 0 }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]">
              <span class="size-2.5 rounded-full bg-[var(--color-warning)] ring-2 ring-[var(--color-warning)]/20"></span>
              {{ stats.statusDistribution?.pending || 0 }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]">
              <span class="size-2.5 rounded-full bg-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/20"></span>
              {{ stats.statusDistribution?.rejected || 0 }}
            </span>
          </div>
          <div v-else class="mt-2 flex h-6 items-center sm:mt-3">
            <span class="inline-block h-5 w-24 animate-pulse rounded-lg bg-[var(--color-primary)]/10"></span>
          </div>
        </div>
        <div class="absolute -bottom-8 -right-8 -z-0 size-28 rounded-full bg-[var(--color-primary)]/8 opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
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
