<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <!-- 今日订单 -->
    <div 
      @click="$emit('filter', 'today')"
      class="group relative bg-gradient-to-br from-[var(--color-card-blue-bg)] to-white rounded-2xl p-5 border border-[var(--color-card-blue-border)]/60 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      <!-- 装饰背景 -->
      <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--color-card-blue-accent)]/10 blur-xl group-hover:scale-125 transition-transform duration-300"></div>
      
      <div class="relative flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--color-card-blue-text)]/80 font-medium">{{ t('dashboard.todayOrders') }}</div>
          <div class="text-3xl font-bold text-[var(--color-card-blue-accent)] mt-2 tabular-nums">
             <span v-if="loading" class="inline-block w-10 h-8 bg-[var(--color-card-blue-border)] rounded-lg animate-pulse"></span>
             <span v-else>{{ stats.todayCount }}</span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-card-blue-accent)]/20 to-[var(--color-card-blue-accent)]/5 flex items-center justify-center backdrop-blur-sm ring-1 ring-[var(--color-card-blue-accent)]/10">
          <svg class="w-6 h-6 text-[var(--color-card-blue-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 待处理 -->
    <div 
      @click="$emit('filter', 'pending')"
      class="group relative bg-gradient-to-br from-[var(--color-card-orange-bg)] to-white rounded-2xl p-5 border border-[var(--color-card-orange-border)]/60 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      <!-- 装饰背景 -->
      <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--color-card-orange-accent)]/10 blur-xl group-hover:scale-125 transition-transform duration-300"></div>
      
      <div class="relative flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--color-card-orange-text)]/80 font-medium">{{ t('dashboard.pendingOrders') }}</div>
          <div class="text-3xl font-bold text-[var(--color-card-orange-accent)] mt-2 tabular-nums">
             <span v-if="loading" class="inline-block w-10 h-8 bg-[var(--color-card-orange-border)] rounded-lg animate-pulse"></span>
             <span v-else>{{ stats.pendingCount }}</span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-card-orange-accent)]/20 to-[var(--color-card-orange-accent)]/5 flex items-center justify-center backdrop-blur-sm ring-1 ring-[var(--color-card-orange-accent)]/10">
          <svg class="w-6 h-6 text-[var(--color-card-orange-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 本周订单 -->
    <div class="group relative bg-gradient-to-br from-[var(--color-card-green-bg)] to-white rounded-2xl p-5 border border-[var(--color-card-green-border)]/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
      <!-- 装饰背景 -->
      <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--color-card-green-accent)]/10 blur-xl group-hover:scale-125 transition-transform duration-300"></div>
      
      <div class="relative flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--color-card-green-text)]/80 font-medium">{{ t('order.dashboard.weekOrders') }}</div>
          <div class="text-3xl font-bold text-[var(--color-card-green-accent)] mt-2 tabular-nums">
            <span v-if="loading" class="inline-block w-10 h-8 bg-[var(--color-card-green-border)] rounded-lg animate-pulse"></span>
            <span v-else>{{ stats.weekCount }}</span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-card-green-accent)]/20 to-[var(--color-card-green-accent)]/5 flex items-center justify-center backdrop-blur-sm ring-1 ring-[var(--color-card-green-accent)]/10">
          <svg class="w-6 h-6 text-[var(--color-card-green-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 状态分布 (点击查看饼图) -->
    <div 
      @click="showChartModal = true"
      class="group relative bg-gradient-to-br from-[var(--color-card-purple-bg)] to-white rounded-2xl p-5 border border-[var(--color-card-purple-border)]/60 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      <!-- 装饰背景 -->
      <div class="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[var(--color-card-purple-accent)]/10 blur-xl group-hover:scale-125 transition-transform duration-300"></div>
      
      <div class="relative flex items-center justify-between">
        <div>
          <div class="text-sm text-[var(--color-card-purple-text)]/80 font-medium">{{ t('order.dashboard.statusDistribution') }}</div>
          <div class="flex items-center gap-2.5 mt-2.5" v-if="!loading">
            <span class="inline-flex items-center gap-1.5 text-xs font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] ring-2 ring-[var(--color-success)]/20"></span>
              {{ stats.statusDistribution?.confirmed || 0 }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-[var(--color-warning)] ring-2 ring-[var(--color-warning)]/20"></span>
              {{ stats.statusDistribution?.pending || 0 }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-[var(--color-danger)] ring-2 ring-[var(--color-danger)]/20"></span>
              {{ stats.statusDistribution?.rejected || 0 }}
            </span>
          </div>
          <div v-else class="h-6 flex items-center mt-2">
            <span class="inline-block w-24 h-5 bg-[var(--color-card-purple-border)] rounded-lg animate-pulse"></span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-card-purple-accent)]/20 to-[var(--color-card-purple-accent)]/5 flex items-center justify-center backdrop-blur-sm ring-1 ring-[var(--color-card-purple-accent)]/10">
          <svg class="w-6 h-6 text-[var(--color-card-purple-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// 每次模块可见时刷新数据
onActivated(loadStats);
</script>

