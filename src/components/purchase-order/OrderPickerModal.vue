<template>
  <!-- 背景遮罩 -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="visible" class="fixed inset-0 z-60 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close')"></div>
    </transition>

    <!-- 弹窗主体 -->
    <transition name="modal-slide">
      <div v-if="visible" class="fixed inset-0 z-[61] flex items-center justify-center p-4 sm:p-6">
        <div class="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-(--color-modal-bg) shadow-2xl" style="max-height: calc(100vh - 3rem)">
          <!-- 头部 -->
          <div class="flex items-center justify-between border-b border-(--border-color) px-6 py-4">
            <div>
              <h2 class="text-main text-lg font-bold">{{ t('purchaseOrder.selection.orderTitle') }}</h2>
              <p class="text-secondary mt-0.5 text-sm">{{ t('purchaseOrder.selection.orderSubtitle') }}</p>
            </div>
            <button
              type="button"
              class="text-secondary cursor-pointer rounded-lg p-2 transition-colors hover:bg-(--bg-hover)"
              @click="$emit('close')"
            >
              <AppIcon name="x-mark" class="size-5" />
            </button>
          </div>

          <!-- 搜索栏 -->
          <div class="border-b border-(--border-subtle) px-6 py-3">
            <SearchInput
              v-model="searchQuery"
              :placeholder="t('purchaseOrder.selection.searchOrder')"
              input-class="!rounded-xl !bg-(--bg-page)"
              :debounce="0"
            />
          </div>

          <!-- 列表区域 -->
          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            <!-- 加载骨架 -->
            <div v-if="loading" class="space-y-3">
              <div v-for="i in 4" :key="'sk-' + i" class="flex items-center gap-3 rounded-xl border border-(--border-subtle) p-4">
                <div class="skeleton-shimmer size-5 rounded bg-(--bg-muted)"></div>
                <div class="flex-1 space-y-2">
                  <div class="skeleton-shimmer h-4 w-32 rounded bg-(--bg-muted)"></div>
                  <div class="skeleton-shimmer h-3 w-48 rounded bg-(--bg-muted)"></div>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-else-if="filteredOrders.length === 0" class="flex flex-col items-center justify-center py-12">
              <div class="flex size-16 items-center justify-center rounded-2xl bg-(--bg-muted)">
                <AppIcon name="shopping-bag" class="text-muted size-8" />
              </div>
              <p class="text-secondary mt-4 text-sm">{{ t('purchaseOrder.selection.emptyOrders') }}</p>
            </div>

            <!-- 订单列表 -->
            <div v-else class="space-y-2">
              <!-- 全选 -->
              <label
                class="text-secondary flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-(--border-color) px-4 py-2.5 text-sm font-medium transition-colors hover:bg-(--bg-hover)"
              >
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  :indeterminate="isPartiallySelected"
                  class="text-primary size-4 cursor-pointer rounded border-(--border-color) focus:ring-primary"
                  @change="toggleSelectAll"
                />
                {{ isAllSelected ? t('purchaseOrder.selection.deselectAll') : t('purchaseOrder.selection.selectAll') }}
                <span class="ml-auto font-[Outfit] text-xs">{{ filteredOrders.length }}</span>
              </label>

              <!-- 订单卡片 -->
              <div
                v-for="order in filteredOrders"
                :key="order.id"
                class="group flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all duration-200"
                :class="isSelected(order.id)
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-(--border-subtle) hover:border-(--border-color) hover:bg-(--bg-hover)'"
                @click="viewOrder(order)"
              >
                <div class="pt-0.5" @click.stop>
                  <input
                    type="checkbox"
                    :checked="isSelected(order.id)"
                    class="text-primary size-4 cursor-pointer rounded border-(--border-color) focus:ring-primary"
                    @change="toggleSelect(order)"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <code class="bg-muted text-secondary max-w-[11rem] truncate rounded px-1.5 py-0.5 font-mono text-xs sm:max-w-[15rem]" :title="order.orderNo">{{ order.orderNo }}</code>
                    <span class="text-main shrink-0 font-[Outfit] text-sm font-medium">×{{ order.quantity || 1 }}</span>
                  </div>
                  <div class="text-main mt-1.5 line-clamp-2 text-sm font-medium break-all" :title="order.productName || '—'">{{ order.productName || '—' }}</div>
                  <div class="text-secondary mt-1 flex items-center gap-2 text-xs">
                    <span v-if="order.customer?.name" class="flex min-w-0 items-center gap-1">
                      <AppIcon name="user" class="size-3" />
                      <span class="truncate" :title="order.customer.name">{{ order.customer.name }}</span>
                    </span>
                    <span v-if="order.brand" class="bg-muted max-w-[9rem] truncate rounded px-1.5 py-0.5" :title="order.brand">{{ order.brand }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="flex items-center justify-between border-t border-(--border-color) bg-(--bg-card) px-6 py-4">
            <span v-if="selected.length > 0" class="text-secondary text-sm">
              {{ t('purchaseOrder.selection.selectedCount', { count: selected.length }) }}
            </span>
            <span v-else></span>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="text-secondary cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-(--bg-hover)"
                @click="$emit('close')"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                :disabled="selected.length === 0"
                class="bg-primary text-inverse cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                @click="confirm"
              >
                {{ t('common.confirm') }} ({{ selected.length }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <OrderWorkflowModal
      v-model:show="showDetailModal"
      :order="viewingOrder"
      :hydrating="loadingDetail"
      :hydration-error="detailError"
      :commenting="commenting"
      @close="closeDetail"
      @retry="() => viewingOrder?.id && viewOrder(viewingOrder)"
      @comment="handleComment"
      @refresh="refreshOrderDetail"
    />
  </Teleport>
</template>

<script setup>
/**
 * 预定单选择弹窗 (OrderPickerModal)
 * ====================================
 *
 * 列出所有 confirmed 状态的客户订单，支持搜索 + 多选。
 * 选中后 emit('confirm', orders) 返回完整的订单对象数组。
 *
 * @module components/purchase-order/OrderPickerModal
 */

import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useOrders } from '@/composables/useOrders';
import OrderWorkflowModal from '@/components/order/OrderWorkflowModal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import SearchInput from '@/components/ui/SearchInput.vue';

const props = defineProps({
  /** 控制弹窗可见性 */
  visible: { type: Boolean, default: false },
  /** 已经被选中的订单 ID (排除重复选择) */
  excludeIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'confirm']);

const { t } = useI18n();
const { loadOrders, orders, loading, getOrder, addComment } = useOrders();

// ─── 状态 ────────────────────────────────────────────
const searchQuery = ref('');
const selected = ref([]);

const showDetailModal = ref(false);
const loadingDetail = ref(false);
const viewingOrder = ref(null);
const commenting = ref(false);
const detailError = ref('');

const viewOrder = async (order) => {
  showDetailModal.value = true;
  loadingDetail.value = true;
  detailError.value = '';
  viewingOrder.value = order ? { ...order } : null;
  
  try {
    const fullOrder = await getOrder(order.id);
    if (fullOrder) {
      viewingOrder.value = fullOrder;
    } else {
      detailError.value = t('common.loadFailed');
    }
  } catch (_e) {
    detailError.value = t('common.networkError');
  } finally {
    loadingDetail.value = false;
  }
};

const refreshOrderDetail = async () => {
  if (viewingOrder.value) {
    loadingDetail.value = true;
    detailError.value = '';
    try {
      const fullOrder = await getOrder(viewingOrder.value.id);
      if (fullOrder) {
        viewingOrder.value = fullOrder;
      } else {
        detailError.value = t('common.loadFailed');
      }
    } catch (_e) {
      detailError.value = t('common.networkError');
    } finally {
      loadingDetail.value = false;
    }
  }
};

const closeDetail = () => {
  showDetailModal.value = false;
  loadingDetail.value = false;
  detailError.value = '';
  viewingOrder.value = null;
};

const handleComment = async (comment) => {
  if (!viewingOrder.value || !comment.trim() || commenting.value) return;
  commenting.value = true;
  try {
    const success = await addComment(viewingOrder.value.id, comment);
    if (success) {
      await refreshOrderDetail();
    }
  } finally {
    commenting.value = false;
  }
};

// ─── 前端过滤 ────────────────────────────────────────
const filteredOrders = computed(() => {
  let list = orders.value || [];

  // 排除已在采购单中的订单
  if (props.excludeIds.length > 0) {
    const excludeSet = new Set(props.excludeIds);
    list = list.filter(o => !excludeSet.has(o.id));
  }

  // 严格过滤仅已确认状态
  list = list.filter(o => o.status === 'confirmed');

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(o =>
      (o.orderNo || '').toLowerCase().includes(q) ||
      (o.productName || '').toLowerCase().includes(q) ||
      (o.customer?.name || '').toLowerCase().includes(q)
    );
  }

  return list;
});

// ─── 全选逻辑 ────────────────────────────────────────
const isAllSelected = computed(() =>
  filteredOrders.value.length > 0 && selected.value.length === filteredOrders.value.length
);
const isPartiallySelected = computed(() =>
  selected.value.length > 0 && selected.value.length < filteredOrders.value.length
);

const isSelected = (id) => selected.value.some(o => o.id === id);

const toggleSelect = (order) => {
  const idx = selected.value.findIndex(o => o.id === order.id);
  if (idx >= 0) {
    selected.value.splice(idx, 1);
  } else {
    selected.value.push(order);
  }
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selected.value = [];
  } else {
    selected.value = [...filteredOrders.value];
  }
};

// ─── 确认操作 ────────────────────────────────────────
const confirm = () => {
  emit('confirm', [...selected.value]);
  emit('close');
};

// ─── 弹窗打开时加载数据 ─────────────────────────────
watch(() => props.visible, async (val) => {
  if (val) {
    selected.value = [];
    searchQuery.value = '';
    await loadOrders({ status: 'confirmed', limit: 100 });
  }
});
</script>

<style scoped>
/* 弹窗进入动画 */
.modal-slide-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-slide-leave-active { transition: all 0.2s ease-in; }
.modal-slide-enter-from { opacity: 0; transform: scale(0.95) translateY(10px); }
.modal-slide-leave-to { opacity: 0; transform: scale(0.97); }

/* 背景淡入 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 骨架屏闪烁 */
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}
.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
  animation: shimmer 1.8s infinite;
}
@keyframes shimmer {
  100% { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .modal-slide-enter-active,
  .modal-slide-leave-active,
  .fade-enter-active,
  .fade-leave-active {
    transition: none !important;
  }

  .skeleton-shimmer::after {
    animation: none !important;
  }
}
</style>
