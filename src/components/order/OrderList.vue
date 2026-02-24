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
          class="order-item group relative cursor-pointer overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
          :style="{ height: `${ITEM_HEIGHT - 12}px` }"
          @click="$emit('view', order)"
        >
          <!-- 状态 Badge (右上角) -->
          <div class="absolute top-3 right-3 z-10">
              <StatusBadge :variant="getStatusVariant(order.status)" size="sm" class="!px-2 !py-0.5 !text-[10px]">
                  {{ t(`order.statuses.${order.status}`) }}
              </StatusBadge>
          </div>

          <div class="flex h-full gap-3">
            <!-- 主图 -->
            <div class="size-20 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
              <AppImage
                v-if="order.mainImage"
                :src="order.mainImage"
                :blurhash="order.mainImageBlurhash"
                fit="cover"
                class="order-list-image size-full transition-transform duration-500 group-hover:scale-110"
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
            <div class="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                <div class="flex items-center gap-2">
                    <span class="text-secondary truncate font-mono text-[10px] tracking-wide" :title="order.orderNo">{{ order.orderNo }}</span>
                    <!-- New Update Red Dot -->
                    <div v-if="order.hasNewFeedback" class="relative flex size-2 shrink-0">
                      <span class="bg-danger absolute inline-flex size-full animate-ping rounded-full opacity-75"></span>
                      <span class="bg-danger relative inline-flex size-2 rounded-full"></span>
                    </div>
                </div>
                <!-- 预留右侧 Badge 空间，防止文字重叠 -->
                <h4 class="text-primary mt-0.5 truncate pr-16 text-sm leading-tight font-bold" :title="order.productName || t('order.form.productName')">
                  {{ order.productName || t('order.form.productName') }}
                </h4>

              <div class="flex items-end justify-between">
                <div class="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <svg class="size-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    <span class="min-w-0 flex-1 truncate" :title="order.customer?.name || t('common.unknown')">{{ order.customer?.name || t('common.unknown') }}</span>
                    <span class="shrink-0 text-[var(--border-color)]">|</span>
                    <span class="shrink-0">{{ formatTime(order.createdAt) }}</span>
                </div>
                
                <!-- 箭头 -->
                <svg
                  class="text-quaternary size-4 shrink-0 -rotate-90 opacity-50 transition-transform group-hover:translate-x-1 group-hover:opacity-100"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
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
// Card Height (20*4 + 1.5*2) + Padding (12*2) = 80 + 24 = 104px content height
// Border (2px) = 106px
// Margin Bottom (12px) = 118px
// Adjusting to fit strictly: let's use 108px content + 12px margin = 120px
const ITEM_HEIGHT = 120; // Re-calibrated
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
