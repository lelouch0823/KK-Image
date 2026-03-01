<template>
  <div class="space-y-6">
    <div
      v-if="error"
      class="rounded-xl border border-[var(--color-danger-text)]/20 bg-[var(--color-danger-bg)]/40 p-4"
      data-testid="stats-error"
    >
      <p class="text-sm text-[var(--text-main)]">{{ error }}</p>
      <button
        type="button"
        class="mt-3 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-inverse)]"
        data-testid="stats-retry"
        @click="loadStats"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <div
      v-else-if="!loading && isEmptyStats"
      class="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] p-4 text-center"
      data-testid="stats-empty"
    >
      <p class="text-sm text-[var(--text-secondary)]">{{ t('common.noData') }}</p>
    </div>

    <!-- 统计卡片 -->
    <div v-else class="grid grid-cols-2 gap-4">
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
const error = ref('');
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

const isEmptyStats = computed(() =>
  stats.value.totalOrders === 0 &&
  stats.value.completedOrders === 0 &&
  stats.value.monthOrders === 0 &&
  stats.value.monthlyTrend.length === 0
);

const loadStats = async () => {
  if (!props.token) return;

  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(API.SALES_STATS(props.token));
    const result = await res.json();
    if (result.success) {
      stats.value = result.data;
    } else {
      error.value = result.error || result.message || t('common.loadFailed');
    }
  } catch (e) {
    error.value = e?.message || t('common.networkError');
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
