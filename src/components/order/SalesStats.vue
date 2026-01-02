<template>
  <div class="space-y-6">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 gap-4">
      <div
        class="rounded-xl border border-[var(--color-card-blue-border)] bg-[var(--color-card-blue-bg)] p-4"
      >
        <div class="text-sm font-medium text-[var(--color-card-blue-text)]">
          {{ t('salesStats.totalOrders') }}
        </div>
        <div class="mt-1 text-2xl font-bold text-[var(--color-card-blue-accent)]">
          <span
            v-if="loading"
            class="inline-block h-6 w-8 animate-pulse rounded bg-[var(--color-card-blue-border)]"
          ></span>
          <span v-else>{{ stats.totalOrders }}</span>
        </div>
      </div>

      <div
        class="rounded-xl border border-[var(--color-card-green-border)] bg-[var(--color-card-green-bg)] p-4"
      >
        <div class="text-sm font-medium text-[var(--color-card-green-text)]">
          {{ t('salesStats.completedOrders') }}
        </div>
        <div class="mt-1 text-2xl font-bold text-[var(--color-card-green-accent)]">
          <span
            v-if="loading"
            class="inline-block h-6 w-8 animate-pulse rounded bg-[var(--color-card-green-border)]"
          ></span>
          <span v-else>{{ stats.completedOrders }}</span>
        </div>
      </div>

      <div
        class="col-span-2 rounded-xl border border-[var(--color-card-purple-border)] bg-[var(--color-card-purple-bg)] p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-[var(--color-card-purple-text)]">
              {{ t('salesStats.monthOrders') }}
            </div>
            <div class="mt-1 text-2xl font-bold text-[var(--color-card-purple-accent)]">
              <span
                v-if="loading"
                class="inline-block h-6 w-8 animate-pulse rounded bg-[var(--color-card-purple-border)]"
              ></span>
              <span v-else>{{ stats.monthOrders }}</span>
            </div>
          </div>
          <div class="hidden sm:block">
            <!-- 迷你趋势图 -->
            <div
              v-if="!loading && stats.monthlyTrend.length > 0"
              class="flex h-10 w-32 items-end gap-1"
            >
              <div
                v-for="(day, index) in stats.monthlyTrend.slice(-15)"
                :key="index"
                class="flex-1 rounded-t-sm bg-[var(--color-card-purple-accent)]/40 transition-all hover:bg-[var(--color-card-purple-accent)]"
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
    required: true,
  },
});

const { t } = useI18n();
const loading = ref(true);
const stats = ref({
  totalOrders: 0,
  completedOrders: 0,
  monthOrders: 0,
  monthlyTrend: [],
});

const maxCount = computed(() => {
  if (!stats.value.monthlyTrend.length) return 1;
  return Math.max(...stats.value.monthlyTrend.map((d) => d.count)) || 1;
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
watch(
  () => props.token,
  (newToken) => {
    if (newToken) loadStats();
  }
);
</script>
