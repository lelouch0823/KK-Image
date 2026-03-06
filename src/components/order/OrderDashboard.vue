<template>
  <div>
    <div class="grid grid-cols-2 gap-3 sm:gap-4">
      <!-- 今日订单 (Info/Primary) -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card)/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:shadow-info/10 hover:-translate-y-0.5 hover:shadow-xl sm:p-5"
        @click="$emit('filter', 'today')"
      >
        <!-- 右上角图标 -->
        <div class="bg-info/10 text-info absolute top-3 right-3 flex size-9 items-center justify-center rounded-xl transition-colors group-hover:bg-info group-hover:text-(--text-inverse) sm:top-4 sm:right-4 sm:size-10">
          <AppIcon name="clock" class="size-4.5 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
        </div>
        <!-- 内容 -->
        <div class="relative z-10">
          <div class="text-xs font-medium whitespace-nowrap text-(--text-secondary) sm:text-sm">{{ t('dashboard.todayOrders') }}</div>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-(--text-main) sm:mt-3 sm:text-4xl">
            <span v-if="loading" class="bg-info/10 inline-block h-9 w-12 animate-pulse rounded-lg"></span>
            <span v-else>{{ stats.todayCount }}</span>
          </div>
        </div>
        <!-- Blob -->
        <div class="bg-info/8 absolute -right-8 -bottom-8 -z-0 size-28 rounded-full opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
      </div>

      <!-- 待处理 (Warning) -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card)/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:shadow-warning/10 hover:-translate-y-0.5 hover:shadow-xl sm:p-5"
        @click="$emit('filter', 'pending')"
      >
        <div class="bg-warning/10 text-warning absolute top-3 right-3 flex size-9 items-center justify-center rounded-xl transition-colors group-hover:bg-warning group-hover:text-(--text-inverse) sm:top-4 sm:right-4 sm:size-10">
          <AppIcon name="exclamation-circle" class="size-4.5 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
        </div>
        <div class="relative z-10">
          <div class="text-xs font-medium whitespace-nowrap text-(--text-secondary) sm:text-sm">{{ t('dashboard.pendingOrders') }}</div>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-(--text-main) sm:mt-3 sm:text-4xl">
            <span v-if="loading" class="bg-warning/10 inline-block h-9 w-12 animate-pulse rounded-lg"></span>
            <span v-else>{{ stats.pendingCount }}</span>
          </div>
        </div>
        <div class="bg-warning/8 absolute -right-8 -bottom-8 -z-0 size-28 rounded-full opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
      </div>

      <!-- 本周订单 (Success) -->
      <div
        class="group relative overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card)/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:shadow-success/10 hover:-translate-y-0.5 hover:shadow-xl sm:p-5"
      >
        <div class="bg-success/10 text-success absolute top-3 right-3 flex size-9 items-center justify-center rounded-xl transition-colors group-hover:bg-success group-hover:text-(--text-inverse) sm:top-4 sm:right-4 sm:size-10">
          <AppIcon name="chart-bar" class="size-4.5 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
        </div>
        <div class="relative z-10">
          <div class="text-xs font-medium whitespace-nowrap text-(--text-secondary) sm:text-sm">{{ t('order.dashboard.weekOrders') }}</div>
          <div class="mt-2 font-[Outfit] text-3xl font-bold tracking-tight text-(--text-main) sm:mt-3 sm:text-4xl">
            <span v-if="loading" class="bg-success/10 inline-block h-9 w-12 animate-pulse rounded-lg"></span>
            <span v-else>{{ stats.weekCount }}</span>
          </div>
        </div>
        <div class="bg-success/8 absolute -right-8 -bottom-8 -z-0 size-28 rounded-full opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
      </div>

      <!-- 状态分布 (Primary/Purple) -->
      <div
        class="group relative cursor-pointer overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card)/60 p-4 shadow-lg backdrop-blur-xl transition-all duration-300 hover:shadow-primary/10 hover:-translate-y-0.5 hover:shadow-xl sm:p-5"
        @click="showChartModal = true"
      >
        <div class="bg-primary/10 text-primary absolute top-3 right-3 flex size-9 items-center justify-center rounded-xl transition-colors group-hover:bg-primary group-hover:text-(--text-inverse) sm:top-4 sm:right-4 sm:size-10">
          <AppIcon name="chart-pie" class="size-4.5 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
        </div>
        <div class="relative z-10">
          <div class="text-xs font-medium whitespace-nowrap text-(--text-secondary) sm:text-sm">{{ t('order.dashboard.statusDistribution') }}</div>
          <div v-if="!loading" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:mt-3">
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-(--text-main)">
              <span class="bg-success ring-success/20 size-2.5 rounded-full ring-2"></span>
              {{ stats.statusDistribution?.confirmed || 0 }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-(--text-main)">
              <span class="bg-warning ring-warning/20 size-2.5 rounded-full ring-2"></span>
              {{ stats.statusDistribution?.pending || 0 }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-(--text-main)">
              <span class="bg-danger ring-danger/20 size-2.5 rounded-full ring-2"></span>
              {{ stats.statusDistribution?.rejected || 0 }}
            </span>
          </div>
          <div v-else class="mt-2 flex h-6 items-center sm:mt-3">
            <span class="bg-primary/10 inline-block h-5 w-24 animate-pulse rounded-lg"></span>
          </div>
        </div>
        <div class="bg-primary/8 absolute -right-8 -bottom-8 -z-0 size-28 rounded-full opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"></div>
      </div>
    </div>
  </div>

  <!-- 状态分布图表弹窗 -->
  <StatusChartModal v-model="showChartModal" :distribution="stats.statusDistribution" />
</template>

<script setup>
import { ref, onMounted, onActivated } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import StatusChartModal from './StatusChartModal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({});

defineEmits(['filter']);

const { t } = useI18n();
const { authFetch } = useAuth();

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
    const res = await authFetch(API.MANAGE_DASHBOARD_STATS);
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
