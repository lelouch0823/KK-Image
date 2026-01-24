<template>
  <div
    class="min-h-[calc(100vh-6rem)]"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Search Bar -->
    <div class="sticky top-14 z-20 -mx-4 mb-4 border-b border-[var(--border-color)] bg-[var(--bg-page)]/95 px-4 py-2 backdrop-blur-sm sm:top-20 sm:mx-0 sm:rounded-xl sm:border">
      <div class="relative">
        <svg
          class="text-secondary absolute top-1/2 left-3 size-4 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('common.searchPlaceholder')"
          class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] py-2 pr-4 pl-9 text-sm transition-all outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
        <button
            v-if="searchQuery"
            class="text-secondary absolute top-1/2 right-3 -translate-y-1/2 hover:text-primary"
            @click="searchQuery = ''"
        >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>
    </div>

    <!-- Pull Indicator (Visual only, logic in OrderList or here) -->
    <div
        v-if="pullDistance > 0 && !isPulling"
        class="flex items-center justify-center overflow-hidden transition-all duration-200"
        :style="{ height: `${pullDistance}px`, opacity: Math.min(pullDistance / 50, 1) }"
    >
        <svg
            class="text-primary size-6 transition-transform duration-200"
            :style="{ transform: `rotate(${pullDistance * 2}deg)` }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
    </div>

    <OrderList
      :orders="filteredOrders"
      :loading="loading"
      :is-pulling="isPulling"
      @refresh="loadOrders"
      @view="handleViewOrder"
    />
  </div>
</template>

<script setup>
import { inject, ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePullToRefresh } from '@/composables/usePullToRefresh';
import OrderList from '@/components/order/OrderList.vue';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

// Inject shared state from Sales.vue (Layout)
const { orders, loading, loadOrders } = inject('salesContext');

// Local Filtering
const searchQuery = ref('');
const filteredOrders = computed(() => {
  if (!searchQuery.value.trim()) return orders.value;
  
  const query = searchQuery.value.toLowerCase();
  return orders.value.filter(order => {
    return (
      order.orderNo?.toLowerCase().includes(query) ||
      order.productName?.toLowerCase().includes(query) ||
      order.customer?.name?.toLowerCase().includes(query)
    );
  });
});

// Pull to Refresh
const { isPulling, pullDistance, handleTouchStart, handleTouchMove, handleTouchEnd } = usePullToRefresh(
  async () => {
    await loadOrders();
  },
  { threshold: 60 }
);

const handleViewOrder = (order) => {
  // Clear new feedback flag locally if present
  if (order.hasNewFeedback) {
    order.hasNewFeedback = false;
  }
  
  router.push(`/sales/${route.params.token}/detail/${order.id}`);
};
</script>
