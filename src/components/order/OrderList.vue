<template>
  <div ref="containerRef" class="order-list">
    <!-- 下拉刷新提示 -->
    <div v-if="isPulling" class="text-secondary flex items-center justify-center py-4 text-sm">
      <svg class="mr-2 size-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        ></path>
      </svg>
      {{ t('common.loading') }}
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && orders.length === 0" class="py-16 text-center">
      <div
        class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-(--bg-muted)"
      >
        <svg class="text-muted size-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          ></path>
        </svg>
      </div>
      <h3 class="text-primary mb-2 text-lg font-medium">{{ t('order.portal.emptyOrders') }}</h3>
      <p class="text-secondary text-sm">{{ t('order.portal.emptyHint') }}</p>
    </div>

    <!-- 虚拟滚动容器 -->
    <div 
      v-else-if="orders.length > 0"
      class="virtual-scroll-container"
      :style="{ height: `${totalHeight}px`, position: 'relative' }"
    >
      <!-- 可见区域偏移容器 -->
      <div 
        class="virtual-scroll-content space-y-3"
        :style="{ transform: `translateY(${offsetTop}px)` }"
      >
        <div
          v-for="order in visibleItems"
          :key="order.id"
          class="order-item group relative cursor-pointer overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card) p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
          :class="getStatusBorderClass(order.status)"
          :style="{ height: `${ITEM_HEIGHT - 12}px` }"
          @click="$emit('view', order)"
        >
          <div class="flex items-start gap-3">
            <!-- 主图 -->
            <div class="size-20 shrink-0 overflow-hidden rounded-lg bg-(--bg-muted) shadow-sm">
              <AppImage
                v-if="order.mainImage"
                :src="order.mainImage"
                :blurhash="order.mainImageBlurhash"
                fit="cover"
                class="order-list-image size-full"
                rounded="none"
              />
              <div v-else class="flex size-full items-center justify-center">
                <svg class="text-muted size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                </svg>
              </div>
            </div>

            <!-- 信息 -->
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <h4 class="text-primary truncate font-medium">
                  {{ order.productName || t('order.form.productName') }}
                </h4>
                <!-- 红点 -->
                <div v-if="order.hasNewFeedback" class="shrink-0">
                  <span
                    class="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text"
                  >
                    <span class="size-1.5 animate-pulse rounded-full bg-danger"></span>
                    {{ t('order.portal.hasUpdate') }}
                  </span>
                </div>
              </div>

              <div class="mt-1 flex items-center gap-2 text-xs">
                <span class="text-secondary rounded bg-(--bg-muted) px-1.5 py-0.5 font-mono">{{ order.orderNo }}</span>
              </div>

              <div class="mt-2 flex items-center justify-between">
                <!-- 状态标签 -->
                <StatusBadge :variant="getStatusVariant(order.status)" size="sm">
                  {{ t(`order.statuses.${order.status}`) }}
                </StatusBadge>

                <!-- 时间 -->
                <span class="text-secondary text-xs">{{ formatTime(order.createdAt) }}</span>
              </div>
            </div>

            <!-- 箭头 -->
            <svg
              class="text-muted size-5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              ></path>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 3" :key="i" type="card" />
    </div>

    <!-- 加载更多 -->
    <div v-if="loadingMore" class="flex items-center justify-center py-4 text-xs text-(--text-secondary)">
      <svg class="mr-2 size-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      {{ t('common.loading') }}...
    </div>
  </div>
</template>

<script setup>
import { ref, computed, toRef, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { formatRelativeTime } from '@/utils/formatters';
import { getStatusVariant } from '@/utils/status';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import AppImage from '@/components/ui/AppImage.vue';

// 常量：每个订单项的高度 (包含 margin)
const ITEM_HEIGHT = 116; // 104px 卡片 + 12px margin
const BUFFER_SIZE = 5; // 上下各多渲染 5 个项目

const props = defineProps({
  orders: { type: Array, default: () => [] },
  loading: Boolean,
  isPulling: Boolean,
  loadingMore: Boolean,
});

defineEmits(['refresh', 'view']);

const { t } = useI18n();

// 虚拟滚动状态
const containerRef = ref(null);
const scrollTop = ref(0);
const containerHeight = ref(0);

// 使用 toRef 确保响应式
const ordersRef = toRef(props, 'orders');

// 计算可见范围
const visibleRange = computed(() => {
  const total = ordersRef.value.length;
  if (total === 0) return { start: 0, end: 0 };

  const startIdx = Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - BUFFER_SIZE);
  const visibleCount = Math.ceil(containerHeight.value / ITEM_HEIGHT);
  const endIdx = Math.min(total, startIdx + visibleCount + BUFFER_SIZE * 2);

  return { start: startIdx, end: endIdx };
});

// 可见项目
const visibleItems = computed(() => {
  const { start, end } = visibleRange.value;
  return ordersRef.value.slice(start, end);
});

// 占位高度 (上方)
const offsetTop = computed(() => visibleRange.value.start * ITEM_HEIGHT);

// 总高度
const totalHeight = computed(() => ordersRef.value.length * ITEM_HEIGHT);

// 滚动处理
const handleScroll = () => {
  scrollTop.value = window.scrollY || document.documentElement.scrollTop;
};

// 容器大小处理
const handleResize = () => {
  containerHeight.value = window.innerHeight;
};

onMounted(() => {
  handleResize();
  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('resize', handleResize);
});

// 状态边框样式
const getStatusBorderClass = (status) => {
  const variant = getStatusVariant(status);
  switch (variant) {
    case 'success':
      return 'border-l-4 border-l-success';
    case 'warning':
      return 'border-l-4 border-l-warning';
    case 'danger':
      return 'border-l-4 border-l-danger';
    case 'info':
      return 'border-l-4 border-l-info';
    default:
      return 'border-l-4 border-l-(--text-muted)';
  }
};

// 格式化时间
const formatTime = (timestamp) => formatRelativeTime(timestamp, t);
</script>

<style scoped>
.order-list {
  /* 确保列表占据合适的空间 */
}

.virtual-scroll-container {
  /* 容器必须有相对定位以支持绝对定位的内容 */
}

.virtual-scroll-content {
  /* 内容区域使用 transform 进行偏移，性能更好 */
  will-change: transform;
}

.order-item {
  /* 固定高度确保虚拟滚动计算正确 */
  box-sizing: border-box;
}
</style>
