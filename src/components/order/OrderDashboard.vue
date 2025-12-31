<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <!-- 今日订单 -->
    <div 
      @click="$emit('filter', 'today')"
      class="bg-gradient-to-br from-[var(--color-card-blue-bg)] to-[var(--color-card-blue-border)] rounded-xl p-4 border border-[var(--color-card-blue-border)]/50 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--color-card-blue-text)] font-medium">{{ t('dashboard.todayOrders') }}</div>
          <div class="text-2xl font-bold text-[var(--color-card-blue-accent)] mt-1">
             <span v-if="loading" class="inline-block w-8 h-6 bg-[var(--color-card-blue-border)] rounded animate-pulse"></span>
             <span v-else>{{ stats.todayCount }}</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-full bg-[var(--color-card-blue-accent)]/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-[var(--color-card-blue-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 待处理 -->
    <div 
      @click="$emit('filter', 'pending')"
      class="bg-gradient-to-br from-[var(--color-card-orange-bg)] to-[var(--color-card-orange-border)] rounded-xl p-4 border border-[var(--color-card-orange-border)]/50 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--color-card-orange-text)] font-medium">{{ t('dashboard.pendingOrders') }}</div>
          <div class="text-2xl font-bold text-[var(--color-card-orange-accent)] mt-1">
             <span v-if="loading" class="inline-block w-8 h-6 bg-[var(--color-card-orange-border)] rounded animate-pulse"></span>
             <span v-else>{{ stats.pendingCount }}</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-full bg-[var(--color-card-orange-accent)]/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-[var(--color-card-orange-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 本周订单 -->
    <div class="bg-gradient-to-br from-[var(--color-card-green-bg)] to-[var(--color-card-green-border)] rounded-xl p-4 border border-[var(--color-card-green-border)]/50">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--color-card-green-text)] font-medium">{{ t('order.dashboard.weekOrders') }}</div>
          <div class="text-2xl font-bold text-[var(--color-card-green-accent)] mt-1">
            <span v-if="loading" class="inline-block w-8 h-6 bg-[var(--color-card-green-border)] rounded animate-pulse"></span>
            <span v-else>{{ stats.weekCount }}</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-full bg-[var(--color-card-green-accent)]/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-[var(--color-card-green-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 状态分布 (点击查看饼图) -->
    <div 
      @click="showChartModal = true"
      class="bg-gradient-to-br from-[var(--color-card-purple-bg)] to-[var(--color-card-purple-border)] rounded-xl p-4 border border-[var(--color-card-purple-border)]/50 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--color-card-purple-text)] font-medium">{{ t('order.dashboard.statusDistribution') }}</div>
          <div class="flex items-center gap-2 mt-1.5" v-if="!loading">
            <span class="inline-flex items-center gap-1 text-xs">
              <span class="w-2 h-2 rounded-full bg-[var(--color-success)]"></span>
              {{ stats.statusDistribution?.confirmed || 0 }}
            </span>
            <span class="inline-flex items-center gap-1 text-xs">
              <span class="w-2 h-2 rounded-full bg-[var(--color-warning)]"></span>
              {{ stats.statusDistribution?.pending || 0 }}
            </span>
            <span class="inline-flex items-center gap-1 text-xs">
              <span class="w-2 h-2 rounded-full bg-[var(--color-danger)]"></span>
              {{ stats.statusDistribution?.rejected || 0 }}
            </span>
          </div>
          <div v-else class="h-6 flex items-center">
            <span class="inline-block w-20 h-4 bg-[var(--color-card-purple-border)] rounded animate-pulse"></span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-full bg-[var(--color-card-purple-accent)]/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-[var(--color-card-purple-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
          </svg>
        </div>
      </div>
    </div>
  </div>


  <!-- 状态分布图表弹窗 -->
  <StatusChartModal
    v-model="showChartModal"
    :distribution="stats.statusDistribution"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue';
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
  statusDistribution: {}
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
</script>
