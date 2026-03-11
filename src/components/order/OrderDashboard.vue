<template>
  <div class="grid grid-cols-2 gap-3 sm:gap-4">
    <MetricTile
      :label="t('dashboard.todayOrders')"
      :value="loading ? '' : stats.todayCount"
      icon="clock"
      tone="info"
      clickable
      @click="$emit('filter', 'today')"
    >
      <template v-if="loading" #value>
        <span class="bg-info/10 inline-block h-9 w-12 animate-pulse rounded-lg"></span>
      </template>
    </MetricTile>

    <MetricTile
      :label="t('dashboard.pendingOrders')"
      :value="loading ? '' : stats.pendingCount"
      icon="exclamation-circle"
      tone="warning"
      clickable
      @click="$emit('filter', 'pending')"
    >
      <template v-if="loading" #value>
        <span class="bg-warning/10 inline-block h-9 w-12 animate-pulse rounded-lg"></span>
      </template>
    </MetricTile>

    <MetricTile
      :label="t('order.dashboard.weekOrders')"
      :value="loading ? '' : stats.weekCount"
      icon="chart-bar"
      tone="success"
    >
      <template v-if="loading" #value>
        <span class="bg-success/10 inline-block h-9 w-12 animate-pulse rounded-lg"></span>
      </template>
    </MetricTile>

    <MetricTile
      :label="t('order.dashboard.statusDistribution')"
      :value="''"
      icon="chart-pie"
      tone="primary"
      clickable
      @click="showChartModal = true"
    >
      <template #value>
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
      </template>
    </MetricTile>
  </div>

  <StatusChartModal v-model="showChartModal" :distribution="stats.statusDistribution" />
</template>

<script setup>
import { ref, onMounted, onActivated } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import StatusChartModal from './StatusChartModal.vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';

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
onActivated(loadStats);
</script>
