<template>
  <div
    class="min-h-[calc(100vh-6rem)]"
    :data-sales-order-mode="salesOrderEntry"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Search Bar -->
    <div class="sticky top-14 z-20 -mx-4 mb-4 border-b border-(--border-color) bg-(--bg-page)/85 px-4 py-3 backdrop-blur-md transition-all sm:top-20 sm:mx-0 sm:rounded-xl sm:border sm:bg-(--bg-card)/90 sm:shadow-sm">
      <div class="group relative">
        <AppIcon
          name="magnifying-glass"
          class="text-secondary absolute top-1/2 left-3.5 size-5 -translate-y-1/2 transition-colors group-focus-within:text-primary"
        />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('common.searchPlaceholder')"
          class="w-full rounded-xl border border-(--border-color) bg-(--bg-muted) py-2.5 pr-10 pl-11 text-sm shadow-sm transition-all outline-none placeholder:text-(--text-muted) focus:border-(--color-primary) focus:bg-(--bg-card) focus:ring-4 focus:ring-(--color-primary)/10"
        />
        <button
            v-if="searchQuery"
            class="text-secondary absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 hover:text-primary hover:bg-(--bg-muted)"
            @click="searchQuery = ''"
        >
            <AppIcon name="x-mark" class="size-4" />
        </button>
      </div>
    </div>

    <!-- Pull Indicator (Visual only, logic in OrderList or here) -->
    <div
        v-if="pullDistance > 0 && !isPulling"
        class="flex items-center justify-center overflow-hidden transition-all duration-200"
        :style="{ height: `${pullDistance}px`, opacity: Math.min(pullDistance / 50, 1) }"
    >
        <AppIcon
            name="arrow-down"
            class="text-primary size-6 transition-transform duration-200"
            :style="{ transform: `rotate(${pullDistance * 2}deg)` }"
        />
    </div>

    <OrderList
      :orders="filteredOrders"
      :loading="loading"
      :error="listError"
      :is-pulling="isPulling"
      :loading-more="infiniteScroll.isLoading.value"
      @refresh="loadOrders"
      @view="handleViewOrder"
    />

    <!-- Infinite Scroll Trigger -->
    <div class="pb-20">
      <div 
        v-if="infiniteScroll.canLoadMore.value && filteredOrders.length === orders.length"
        :ref="(el) => infiniteScroll.triggerRef.value = el"
        class="flex items-center justify-center py-4 text-sm text-(--text-secondary)"
      >
        <div v-if="infiniteScroll.isLoading.value" class="border-t-primary size-5 animate-spin rounded-full border-2 border-(--border-color)"></div>
        <span v-else>↑ {{ t('common.loading') }}</span>
      </div>
      <div v-else-if="orders.length > 0 && !infiniteScroll.canLoadMore.value" class="py-4 text-center text-sm text-(--text-secondary)">
        {{ t('common.total') }} {{ pagination?.total || orders.length }} {{ t('common.items') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, computed, watch, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePullToRefresh } from '@/composables/usePullToRefresh';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';
import OrderList from '@/components/order/OrderList.vue';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();

// Inject shared state from Sales.vue (Layout)
const salesContext = inject('salesContext', {});
const {
  orders = ref([]),
  loading = ref(false),
  loadOrders = async () => {},
  pagination = { page: 1, totalPages: 1, total: 0 },
  searchQuery = ref(''),
  salesOrderMode = ref('legacy'),
  salesOrderStateMachine = null,
} = salesContext;
const salesOrderEntry = computed(() => salesOrderMode.value || 'legacy');
const listError = computed(() => salesOrderStateMachine?.error?.value || '');

// Local Filtering
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

// Infinite Scroll using composable
const infiniteScroll = useInfiniteScroll(async () => {
  // Don't load more while searching
  if (filteredOrders.value.length !== orders.value.length) {
    infiniteScroll.setCanLoadMore(false);
    return;
  }
  if (!pagination || pagination.page >= pagination.totalPages) {
    infiniteScroll.setCanLoadMore(false);
    return;
  }
  await loadOrders(pagination.page + 1, true);
  infiniteScroll.setCanLoadMore(pagination.page < pagination.totalPages);
}, { rootMargin: '200px' });

// Watch for search changes to reset infinite scroll
watch(searchQuery, () => {
  if (searchQuery.value.trim()) {
    infiniteScroll.setCanLoadMore(false);
  } else {
    infiniteScroll.setCanLoadMore(pagination?.page < pagination?.totalPages);
  }
});
</script>
