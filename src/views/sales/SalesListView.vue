<template>
  <div
    class="min-h-[calc(100vh-6rem)]"
    :data-sales-order-mode="salesOrderEntry"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Search Bar -->
    <div class="sticky top-14 z-20 -mx-4 mb-4 border-b border-(--border-color) bg-(--bg-page) px-4 py-3 transition-[background-color,box-shadow,border-radius] duration-200 sm:top-20 sm:mx-0 sm:rounded-xl sm:border sm:bg-(--bg-card) sm:shadow-card">
      <SearchInput
        v-model="searchQuery"
        :placeholder="t('common.searchPlaceholder')"
        input-class="!h-11 !rounded-xl !bg-(--bg-muted) shadow-sm"
        :debounce="300"
        @search="handleSearch"
      />
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
      :orders="displayedOrders"
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
        v-if="infiniteScroll.canLoadMore.value"
        :ref="(el) => infiniteScroll.triggerRef.value = el"
        class="h-10 w-full"
      ></div>
      <div v-else-if="orders.length > 0 && !infiniteScroll.canLoadMore.value" class="py-4 text-center text-sm text-(--text-secondary)">
        {{ t('common.total') }} {{ pagination?.total || orders.length }} {{ t('common.items') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePullToRefresh } from '@/composables/usePullToRefresh';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';
import OrderList from '@/components/order/OrderList.vue';
import SearchInput from '@/components/ui/SearchInput.vue';

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

const displayedOrders = computed(() => orders.value);

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
  if (!pagination || pagination.page >= pagination.totalPages) {
    infiniteScroll.setCanLoadMore(false);
    return;
  }
  await loadOrders(pagination.page + 1, true, searchQuery.value.trim());
  infiniteScroll.setCanLoadMore(pagination.page < pagination.totalPages);
}, { rootMargin: '200px' });

// 搜索通过服务端执行，确保后续页码在当前查询下仍可访问
const handleSearch = async () => {
  await loadOrders(1, false, searchQuery.value.trim());
  infiniteScroll.setCanLoadMore(pagination?.page < pagination?.totalPages);
};
</script>
