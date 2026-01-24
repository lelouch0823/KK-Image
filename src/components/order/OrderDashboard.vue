<template>
  <div :class="{ 'mb-4 lg:mb-6': !isPopup }">
    <!-- 移动端: 可折叠的横向滚动卡片条 (仅在非弹窗模式且非桌面端显示) -->
    <div v-if="!isPopup" class="lg:hidden">
      <!-- 折叠控制按钮 -->
      <button
        class="mb-2 flex w-full items-center justify-between rounded-lg bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--bg-card-hover)]"
        @click="collapsed = !collapsed"
      >
        <span class="flex items-center gap-2">
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {{ t('dashboard.stats') }}
        </span>
        <svg
          class="size-4 transition-transform duration-200"
          :class="{ 'rotate-180': !collapsed }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- 横向滚动卡片容器 -->
      <Transition name="collapse">
        <div v-show="!collapsed" class="overflow-hidden">
          <div class="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            <!-- 移动端滚动内容 (保留原有逻辑作为回退) -->
            <!-- ... content omitted for brevity, logic identical to below but different wrapper ... -->
            <!-- (Actually, let's just reuse the generic structure if possible, but distinct layouts are cleaner for now) -->
             <!-- 今日订单 -->
            <div
              class="flex min-w-[140px] shrink-0 cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-card-blue-border)]/60 bg-gradient-to-br from-[var(--color-card-blue-bg)] to-[var(--bg-card)] px-3 py-2.5 shadow-sm transition-all duration-200 active:scale-95"
              @click="$emit('filter', 'today')"
            >
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card-blue-accent)]/20">
                <svg class="size-4 text-[var(--color-card-blue-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div class="text-[10px] font-medium text-[var(--color-card-blue-text)]/70">{{ t('dashboard.todayOrders') }}</div>
                <div class="text-lg leading-tight font-bold text-[var(--color-card-blue-accent)] tabular-nums">
                  <span v-if="loading" class="inline-block h-5 w-6 animate-pulse rounded bg-[var(--color-card-blue-border)]"></span>
                  <span v-else>{{ stats.todayCount }}</span>
                </div>
              </div>
            </div>
             <!-- 待处理 -->
            <div
              class="flex min-w-[140px] shrink-0 cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-card-orange-border)]/60 bg-gradient-to-br from-[var(--color-card-orange-bg)] to-[var(--bg-card)] px-3 py-2.5 shadow-sm transition-all duration-200 active:scale-95"
              @click="$emit('filter', 'pending')"
            >
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card-orange-accent)]/20">
                <svg class="size-4 text-[var(--color-card-orange-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div class="text-[10px] font-medium text-[var(--color-card-orange-text)]/70">{{ t('dashboard.pendingOrders') }}</div>
                <div class="text-lg leading-tight font-bold text-[var(--color-card-orange-accent)] tabular-nums">
                  <span v-if="loading" class="inline-block h-5 w-6 animate-pulse rounded bg-[var(--color-card-orange-border)]"></span>
                  <span v-else>{{ stats.pendingCount }}</span>
                </div>
              </div>
            </div>
             <!-- 本周订单 -->
            <div
              class="flex min-w-[140px] shrink-0 items-center gap-3 rounded-xl border border-[var(--color-card-green-border)]/60 bg-gradient-to-br from-[var(--color-card-green-bg)] to-[var(--bg-card)] px-3 py-2.5 shadow-sm transition-all duration-200"
            >
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card-green-accent)]/20">
                <svg class="size-4 text-[var(--color-card-green-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <div class="text-[10px] font-medium text-[var(--color-card-green-text)]/70">{{ t('order.dashboard.weekOrders') }}</div>
                <div class="text-lg leading-tight font-bold text-[var(--color-card-green-accent)] tabular-nums">
                  <span v-if="loading" class="inline-block h-5 w-6 animate-pulse rounded bg-[var(--color-card-green-border)]"></span>
                  <span v-else>{{ stats.weekCount }}</span>
                </div>
              </div>
            </div>
             <!-- 状态分布 -->
            <div
              class="flex min-w-[160px] shrink-0 cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-card-purple-border)]/60 bg-gradient-to-br from-[var(--color-card-purple-bg)] to-[var(--bg-card)] px-3 py-2.5 shadow-sm transition-all duration-200 active:scale-95"
              @click="showChartModal = true"
            >
              <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-card-purple-accent)]/20">
                <svg class="size-4 text-[var(--color-card-purple-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
              <div>
                <div class="text-[10px] font-medium text-[var(--color-card-purple-text)]/70">{{ t('order.dashboard.statusDistribution') }}</div>
                 <div v-if="!loading" class="flex items-center gap-1.5 pt-0.5">
                  <span class="inline-flex items-center gap-1 text-[10px] font-medium">
                    <span class="size-1.5 rounded-full bg-[var(--color-success)]"></span>
                    {{ stats.statusDistribution?.confirmed || 0 }}
                  </span>
                  <span class="inline-flex items-center gap-1 text-[10px] font-medium">
                    <span class="size-1.5 rounded-full bg-[var(--color-warning)]"></span>
                    {{ stats.statusDistribution?.pending || 0 }}
                  </span>
                  <span class="inline-flex items-center gap-1 text-[10px] font-medium">
                    <span class="size-1.5 rounded-full bg-[var(--color-danger)]"></span>
                    {{ stats.statusDistribution?.rejected || 0 }}
                  </span>
                </div>
                <div v-else class="h-4 w-16 animate-pulse rounded bg-[var(--color-card-purple-border)]"></div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 弹窗/桌面端: 网格布局 -->
    <div
      class="gap-4"
      :class="[
        isPopup ? 'grid grid-cols-2' : 'hidden lg:grid lg:grid-cols-4'
      ]"
    >
      <!-- 今日订单 -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-card-blue-border)]/60 bg-gradient-to-br from-[var(--color-card-blue-bg)] to-[var(--bg-card)] p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95 sm:p-5"
        @click="$emit('filter', 'today')"
      >
        <div class="absolute -top-6 -right-6 size-20 rounded-full bg-[var(--color-card-blue-accent)]/10 blur-xl transition-transform duration-300 group-hover:scale-125"></div>
        <div class="relative flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div class="text-xs font-medium text-[var(--color-card-blue-text)]/80 sm:text-sm">{{ t('dashboard.todayOrders') }}</div>
            <div class="mt-1 text-2xl font-bold text-[var(--color-card-blue-accent)] tabular-nums sm:mt-2 sm:text-3xl">
              <span v-if="loading" class="inline-block h-8 w-10 animate-pulse rounded-lg bg-[var(--color-card-blue-border)]"></span>
              <span v-else>{{ stats.todayCount }}</span>
            </div>
          </div>
          <div class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-card-blue-accent)]/20 to-[var(--color-card-blue-accent)]/5 ring-1 ring-[var(--color-card-blue-accent)]/10 backdrop-blur-sm sm:size-12">
            <svg class="size-5 text-[var(--color-card-blue-accent)] sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 待处理 -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-card-orange-border)]/60 bg-gradient-to-br from-[var(--color-card-orange-bg)] to-[var(--bg-card)] p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95 sm:p-5"
        @click="$emit('filter', 'pending')"
      >
        <div class="absolute -top-6 -right-6 size-20 rounded-full bg-[var(--color-card-orange-accent)]/10 blur-xl transition-transform duration-300 group-hover:scale-125"></div>
        <div class="relative flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div class="text-xs font-medium text-[var(--color-card-orange-text)]/80 sm:text-sm">{{ t('dashboard.pendingOrders') }}</div>
            <div class="mt-1 text-2xl font-bold text-[var(--color-card-orange-accent)] tabular-nums sm:mt-2 sm:text-3xl">
              <span v-if="loading" class="inline-block h-8 w-10 animate-pulse rounded-lg bg-[var(--color-card-orange-border)]"></span>
              <span v-else>{{ stats.pendingCount }}</span>
            </div>
          </div>
          <div class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-card-orange-accent)]/20 to-[var(--color-card-orange-accent)]/5 ring-1 ring-[var(--color-card-orange-accent)]/10 backdrop-blur-sm sm:size-12">
            <svg class="size-5 text-[var(--color-card-orange-accent)] sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 本周订单 -->
      <div
        class="group relative overflow-hidden rounded-2xl border border-[var(--color-card-green-border)]/60 bg-gradient-to-br from-[var(--color-card-green-bg)] to-[var(--bg-card)] p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-5"
      >
        <div class="absolute -top-6 -right-6 size-20 rounded-full bg-[var(--color-card-green-accent)]/10 blur-xl transition-transform duration-300 group-hover:scale-125"></div>
        <div class="relative flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div class="text-xs font-medium text-[var(--color-card-green-text)]/80 sm:text-sm">{{ t('order.dashboard.weekOrders') }}</div>
            <div class="mt-1 text-2xl font-bold text-[var(--color-card-green-accent)] tabular-nums sm:mt-2 sm:text-3xl">
              <span v-if="loading" class="inline-block h-8 w-10 animate-pulse rounded-lg bg-[var(--color-card-green-border)]"></span>
              <span v-else>{{ stats.weekCount }}</span>
            </div>
          </div>
          <div class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-card-green-accent)]/20 to-[var(--color-card-green-accent)]/5 ring-1 ring-[var(--color-card-green-accent)]/10 backdrop-blur-sm sm:size-12">
            <svg class="size-5 text-[var(--color-card-green-accent)] sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 状态分布 -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-card-purple-border)]/60 bg-gradient-to-br from-[var(--color-card-purple-bg)] to-[var(--bg-card)] p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95 sm:p-5"
        @click="showChartModal = true"
      >
        <div class="absolute -top-6 -right-6 size-20 rounded-full bg-[var(--color-card-purple-accent)]/10 blur-xl transition-transform duration-300 group-hover:scale-125"></div>
        <div class="relative flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div class="text-xs font-medium text-[var(--color-card-purple-text)]/80 sm:text-sm">{{ t('order.dashboard.statusDistribution') }}</div>
            <div v-if="!loading" class="mt-2 flex flex-col gap-1 sm:mt-2.5 sm:flex-row sm:items-center sm:gap-2.5">
              <span class="inline-flex items-center gap-1.5 text-[10px] font-medium sm:text-xs">
                <span class="size-2 rounded-full bg-[var(--color-success)] ring-2 ring-[var(--color-success)]/20 sm:size-2.5"></span>
                {{ stats.statusDistribution?.confirmed || 0 }}
              </span>
              <span class="inline-flex items-center gap-1.5 text-[10px] font-medium sm:text-xs">
                <span class="size-2 rounded-full bg-[var(--color-warning)] ring-2 ring-[var(--color-warning)]/20 sm:size-2.5"></span>
                {{ stats.statusDistribution?.pending || 0 }}
              </span>
              <span class="inline-flex items-center gap-1.5 text-[10px] font-medium sm:text-xs">
                <span class="size-2 rounded-full bg-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/20 sm:size-2.5"></span>
                {{ stats.statusDistribution?.rejected || 0 }}
              </span>
            </div>
            <div v-else class="mt-2 flex h-6 items-center">
              <span class="inline-block h-5 w-24 animate-pulse rounded-lg bg-[var(--color-card-purple-border)]"></span>
            </div>
          </div>
          <div class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-card-purple-accent)]/20 to-[var(--color-card-purple-accent)]/5 ring-1 ring-[var(--color-card-purple-accent)]/10 backdrop-blur-sm sm:size-12">
            <svg class="size-5 text-[var(--color-card-purple-accent)] sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
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

defineProps({
  isPopup: {
    type: Boolean,
    default: false
  }
});

defineEmits(['filter']);

const { t } = useI18n();

const loading = ref(true);
const collapsed = ref(false); // 移动端折叠状态
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
