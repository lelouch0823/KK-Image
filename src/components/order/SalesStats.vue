<template>
  <div class="space-y-6">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-[var(--color-card-blue-bg)] rounded-xl p-4 border border-[var(--color-card-blue-border)]">
        <div class="text-sm text-[var(--color-card-blue-text)] font-medium">{{ t('salesStats.totalOrders') }}</div>
        <div class="text-2xl font-bold text-[var(--color-card-blue-accent)] mt-1">
          <span v-if="loading" class="inline-block w-8 h-6 bg-[var(--color-card-blue-border)] rounded animate-pulse"></span>
          <span v-else>{{ stats.totalOrders }}</span>
        </div>
      </div>
      
      <div class="bg-[var(--color-card-green-bg)] rounded-xl p-4 border border-[var(--color-card-green-border)]">
        <div class="text-sm text-[var(--color-card-green-text)] font-medium">{{ t('salesStats.completedOrders') }}</div>
        <div class="text-2xl font-bold text-[var(--color-card-green-accent)] mt-1">
          <span v-if="loading" class="inline-block w-8 h-6 bg-[var(--color-card-green-border)] rounded animate-pulse"></span>
          <span v-else>{{ stats.completedOrders }}</span>
        </div>
      </div>

      <div class="bg-[var(--color-card-purple-bg)] rounded-xl p-4 border border-[var(--color-card-purple-border)] col-span-2">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-[var(--color-card-purple-text)] font-medium">{{ t('salesStats.monthOrders') }}</div>
            <div class="text-2xl font-bold text-[var(--color-card-purple-accent)] mt-1">
              <span v-if="loading" class="inline-block w-8 h-6 bg-[var(--color-card-purple-border)] rounded animate-pulse"></span>
              <span v-else>{{ stats.monthOrders }}</span>
            </div>
          </div>
          <div class="hidden sm:block">
            <!-- 迷你趋势图 -->
            <div class="flex items-end gap-1 h-10 w-32" v-if="!loading && stats.monthlyTrend.length > 0">
               <div 
                 v-for="(day, index) in stats.monthlyTrend.slice(-15)" 
                 :key="index"
                 class="flex-1 bg-[var(--color-card-purple-accent)]/40 rounded-t-sm transition-all hover:bg-[var(--color-card-purple-accent)]"
                 :style="{ height: `${Math.max(10, (day.count / maxCount) * 100)}%` }"
                 :title="`${day.date}: ${day.count}`"
               ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';

const props = defineProps({
  token: {
    type: String,
    required: true
  }
});

const { t } = useI18n();
const loading = ref(true);
const stats = ref({
  totalOrders: 0,
  completedOrders: 0,
  monthOrders: 0,
  monthlyTrend: []
});

const maxCount = computed(() => {
  if (!stats.value.monthlyTrend.length) return 1;
  return Math.max(...stats.value.monthlyTrend.map(d => d.count)) || 1;
});

const loadStats = async () => {
  if (!props.token) return;
  
  loading.value = true;
  try {
    const res = await fetch(API.SALES_STATS(props.token));
    const result = await res.json();
    if (result.success) {
      stats.value = result.data;
    }
  } catch (e) {
    console.error('Failed to load sales stats:', e);
  } finally {
    loading.value = false;
  }
};

onMounted(loadStats);

// 监听 token 变化重新加载
watch(() => props.token, (newToken) => {
  if (newToken) loadStats();
});
</script>
