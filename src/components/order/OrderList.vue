<template>
  <div ref="containerRef" class="order-list">
    <!-- 下拉刷新提示 -->
    <div v-if="isPulling" class="flex items-center justify-center py-4 text-sm text-(--text-secondary)">
      <AppIcon name="spinner" class="mr-2 size-4 animate-spin" />
      {{ t('common.loading') }}
    </div>

    <AsyncStatePanel
      v-if="!loading && error"
      state="error"
      :description="error"
      @retry="$emit('refresh')"
    />

    <AsyncStatePanel
      v-else-if="!loading && !error && orders.length === 0"
      state="empty"
      :title="t('order.portal.emptyOrders')"
      :description="t('order.portal.emptyHint')"
    />

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
          class="order-item group relative cursor-pointer overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card) p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
          :style="{ height: `${ITEM_HEIGHT - 12}px` }"
          @click="$emit('view', order)"
        >
          <!-- 状态 Badge (右上角) -->
          <div class="absolute top-3 right-3 z-10 flex flex-col items-end gap-1">
              <StatusBadge :variant="getStatusVariant(order.status)" size="sm" class="!px-2 !py-0.5 !text-[10px]">
                  {{ t(`order.statuses.${order.status}`) }}
              </StatusBadge>
              <OrderProcurementBadge :status="order.procurementStatus" compact />
          </div>

          <div class="flex h-full gap-3">
            <!-- 主图 -->
            <div class="size-20 shrink-0 overflow-hidden rounded-lg bg-(--bg-muted) shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
              <AppImage
                v-if="order.mainImage"
                :src="order.mainImage"
                :blurhash="order.mainImageBlurhash"
                fit="cover"
                class="order-list-image size-full transition-transform duration-500 group-hover:scale-110"
                rounded="none"
              />
              <div v-else class="flex size-full items-center justify-center">
                <AppIcon name="photo" class="size-8 text-(--text-muted)" />
              </div>
            </div>

            <!-- 信息 -->
            <div class="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                <div class="flex items-center gap-2">
                    <span class="truncate font-mono text-[10px] tracking-wide text-(--text-secondary)" :title="order.orderNo">{{ order.orderNo }}</span>
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
                <div class="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-(--text-secondary)">
                    <AppIcon name="user" class="size-3.5 shrink-0 opacity-70" />
                    <span class="min-w-0 flex-1 truncate" :title="order.customer?.name || t('common.unknown')">{{ order.customer?.name || t('common.unknown') }}</span>
                    <span class="shrink-0 text-(--border-color)">|</span>
                    <span class="shrink-0">{{ formatTime(order.createdAt) }}</span>
                </div>
                
                <!-- 箭头 -->
                <AppIcon
                  name="chevron-down"
                  class="size-4 shrink-0 -rotate-90 text-(--text-quaternary) opacity-50 transition-transform group-hover:translate-x-1 group-hover:opacity-100"
                />
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
      <AppIcon name="spinner" class="mr-2 size-4 animate-spin" />
      {{ t('common.loadingMore') || '正在加载...' }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, toRef, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { formatRelativeTime } from '@/utils/formatters';
import { getStatusVariant } from '@/utils/status';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import OrderProcurementBadge from '@/components/order/OrderProcurementBadge.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AsyncStatePanel from '@/components/common/AsyncStatePanel.vue';

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
  error: { type: String, default: '' },
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
