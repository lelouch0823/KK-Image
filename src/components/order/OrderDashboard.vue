<template>
  <div class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
    <!-- 今日订单 -->
    <div
      class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-card-blue-border)]/60 bg-gradient-to-br from-[var(--color-card-blue-bg)] to-[var(--bg-card)] p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95"
      @click="$emit('filter', 'today')"
    >
      <!-- 装饰背景 -->
      <div
        class="absolute -top-6 -right-6 size-20 rounded-full bg-[var(--color-card-blue-accent)]/10 blur-xl transition-transform duration-300 group-hover:scale-125"
      ></div>

      <div class="relative flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-[var(--color-card-blue-text)]/80">
            {{ t('dashboard.todayOrders') }}
          </div>
          <div class="mt-2 text-3xl font-bold text-[var(--color-card-blue-accent)] tabular-nums">
            <span
              v-if="loading"
              class="inline-block h-8 w-10 animate-pulse rounded-lg bg-[var(--color-card-blue-border)]"
            ></span>
            <span v-else>{{ stats.todayCount }}</span>
          </div>
        </div>
        <div
          class="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-card-blue-accent)]/20 to-[var(--color-card-blue-accent)]/5 ring-1 ring-[var(--color-card-blue-accent)]/10 backdrop-blur-sm"
        >
          <svg
            class="size-6 text-[var(--color-card-blue-accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- 待处理 -->
    <div
      class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-card-orange-border)]/60 bg-gradient-to-br from-[var(--color-card-orange-bg)] to-[var(--bg-card)] p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95"
      @click="$emit('filter', 'pending')"
    >
      <!-- 装饰背景 -->
      <div
        class="absolute -top-6 -right-6 size-20 rounded-full bg-[var(--color-card-orange-accent)]/10 blur-xl transition-transform duration-300 group-hover:scale-125"
      ></div>

      <div class="relative flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-[var(--color-card-orange-text)]/80">
            {{ t('dashboard.pendingOrders') }}
          </div>
          <div class="mt-2 text-3xl font-bold text-[var(--color-card-orange-accent)] tabular-nums">
            <span
              v-if="loading"
              class="inline-block h-8 w-10 animate-pulse rounded-lg bg-[var(--color-card-orange-border)]"
            ></span>
            <span v-else>{{ stats.pendingCount }}</span>
          </div>
        </div>
        <div
          class="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-card-orange-accent)]/20 to-[var(--color-card-orange-accent)]/5 ring-1 ring-[var(--color-card-orange-accent)]/10 backdrop-blur-sm"
        >
          <svg
            class="size-6 text-[var(--color-card-orange-accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- 本周订单 -->
    <div
      class="group relative overflow-hidden rounded-2xl border border-[var(--color-card-green-border)]/60 bg-gradient-to-br from-[var(--color-card-green-bg)] to-[var(--bg-card)] p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <!-- 装饰背景 -->
      <div
        class="absolute -top-6 -right-6 size-20 rounded-full bg-[var(--color-card-green-accent)]/10 blur-xl transition-transform duration-300 group-hover:scale-125"
      ></div>

      <div class="relative flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-[var(--color-card-green-text)]/80">
            {{ t('order.dashboard.weekOrders') }}
          </div>
          <div class="mt-2 text-3xl font-bold text-[var(--color-card-green-accent)] tabular-nums">
            <span
              v-if="loading"
              class="inline-block h-8 w-10 animate-pulse rounded-lg bg-[var(--color-card-green-border)]"
            ></span>
            <span v-else>{{ stats.weekCount }}</span>
          </div>
        </div>
        <div
          class="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-card-green-accent)]/20 to-[var(--color-card-green-accent)]/5 ring-1 ring-[var(--color-card-green-accent)]/10 backdrop-blur-sm"
        >
          <svg
            class="size-6 text-[var(--color-card-green-accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- 状态分布 (点击查看饼图) -->
    <div
      class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-card-purple-border)]/60 bg-gradient-to-br from-[var(--color-card-purple-bg)] to-[var(--bg-card)] p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95"
      @click="showChartModal = true"
    >
      <!-- 装饰背景 -->
      <div
        class="absolute -top-6 -right-6 size-20 rounded-full bg-[var(--color-card-purple-accent)]/10 blur-xl transition-transform duration-300 group-hover:scale-125"
      ></div>

      <div class="relative flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-[var(--color-card-purple-text)]/80">
            {{ t('order.dashboard.statusDistribution') }}
          </div>
          <div v-if="!loading" class="mt-2.5 flex items-center gap-2.5">
            <span class="inline-flex items-center gap-1.5 text-xs font-medium">
              <span
                class="size-2.5 rounded-full bg-[var(--color-success)] ring-2 ring-[var(--color-success)]/20"
              ></span>
              {{ stats.statusDistribution?.confirmed || 0 }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium">
              <span
                class="size-2.5 rounded-full bg-[var(--color-warning)] ring-2 ring-[var(--color-warning)]/20"
              ></span>
              {{ stats.statusDistribution?.pending || 0 }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium">
              <span
                class="size-2.5 rounded-full bg-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/20"
              ></span>
              {{ stats.statusDistribution?.rejected || 0 }}
            </span>
          </div>
          <div v-else class="mt-2 flex h-6 items-center">
            <span
              class="inline-block h-5 w-24 animate-pulse rounded-lg bg-[var(--color-card-purple-border)]"
            ></span>
          </div>
        </div>
        <div
          class="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-card-purple-accent)]/20 to-[var(--color-card-purple-accent)]/5 ring-1 ring-[var(--color-card-purple-accent)]/10 backdrop-blur-sm"
        >
          <svg
            class="size-6 text-[var(--color-card-purple-accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
            />
          </svg>
        </div>
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

const emit = defineEmits(['filter']);

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
