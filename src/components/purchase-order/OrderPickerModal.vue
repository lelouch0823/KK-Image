<template>
  <Modal
    :model-value="visible"
    size="3xl"
    :closable="false"
    body-class="!p-0"
    @update:model-value="handleModalVisibilityChange"
  >
    <template #header>
      <div
        data-testid="purchase-order-order-picker-shell"
        class="flex items-start justify-between gap-4"
      >
        <div>
          <p class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
            Order Intake
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ t('purchaseOrder.selection.orderTitle') }}
          </h2>
          <p class="mt-1 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.selection.orderSubtitle') }}
          </p>
        </div>
        <AppButton variant="ghost" size="sm" class="h-9 w-9 px-0" @click="$emit('close')">
          <AppIcon name="x-mark" class="size-5" />
        </AppButton>
      </div>
    </template>

    <div class="flex min-h-0 flex-col">
      <StatePanel
        variant="toolbar"
        data-testid="purchase-order-order-picker-toolbar"
        class="rounded-none border-x-0 border-t-0 px-6 py-4 shadow-none ring-0"
      >
        <SearchInput
          v-model="searchQuery"
          :placeholder="t('purchaseOrder.selection.searchOrder')"
          input-class="!rounded-xl !bg-(--bg-page)"
          :debounce="0"
        />
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge variant="info">
            {{ t('purchaseOrder.ui.availableOrders', '可选订单') }} {{ filteredOrders.length }}
          </StatusBadge>
          <StatusBadge variant="primary">
            {{ t('purchaseOrder.ui.selectedOrders', '已选订单') }} {{ selected.length }}
          </StatusBadge>
          <StatusBadge v-if="excludeIds.length > 0" variant="default">
            {{ t('purchaseOrder.ui.excludedOrders', '已排除') }} {{ excludeIds.length }}
          </StatusBadge>
        </div>
      </StatePanel>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div v-if="loading" class="space-y-3">
          <div
            v-for="i in 4"
            :key="'sk-' + i"
            class="flex items-center gap-3 rounded-xl border border-(--border-subtle) p-4"
          >
            <div class="skeleton-shimmer size-5 rounded bg-(--bg-muted)"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton-shimmer h-4 w-32 rounded bg-(--bg-muted)"></div>
              <div class="skeleton-shimmer h-3 w-48 rounded bg-(--bg-muted)"></div>
            </div>
          </div>
        </div>

        <StatePanel
          v-else-if="filteredOrders.length === 0"
          variant="plain"
          class="flex flex-col items-center justify-center py-12"
        >
          <div class="flex size-16 items-center justify-center rounded-2xl bg-(--bg-muted)">
            <AppIcon name="shopping-bag" class="size-8 text-(--text-muted)" />
          </div>
          <p class="mt-4 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.selection.emptyOrders') }}
          </p>
        </StatePanel>

        <div v-else class="space-y-2">
          <StatePanel
            variant="plain"
            class="rounded-2xl border border-dashed border-(--border-color) bg-(--bg-card) px-4 py-3"
          >
            <div class="flex items-center gap-3 text-sm font-medium text-(--text-secondary)">
              <AppCheckbox :checked="isAllSelected" @change="toggleSelectAll" />
              <span>
                {{
                  isAllSelected
                    ? t('purchaseOrder.selection.deselectAll')
                    : t('purchaseOrder.selection.selectAll')
                }}
              </span>
              <StatusBadge v-if="isPartiallySelected" variant="info">Partial</StatusBadge>
              <span class="ml-auto font-mono text-xs">{{ filteredOrders.length }}</span>
            </div>
          </StatePanel>

          <div
            v-for="order in filteredOrders"
            :key="order.id"
            class="group flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors"
            :class="
              isSelected(order.id)
                ? 'border-primary bg-primary/5'
                : 'border-(--border-subtle) bg-(--bg-card) hover:border-(--border-color) hover:bg-(--bg-hover)'
            "
            @click="viewOrder(order)"
          >
            <div class="pt-0.5" @click.stop>
              <AppCheckbox :checked="isSelected(order.id)" @change="toggleSelect(order)" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <code
                  class="max-w-[11rem] truncate rounded-lg bg-(--bg-muted) px-2 py-0.5 font-mono text-xs text-(--text-secondary) sm:max-w-[15rem]"
                  :title="order.orderNo"
                >
                  {{ order.orderNo }}
                </code>
                <span
                  class="shrink-0 rounded-full bg-(--bg-page) px-2 py-0.5 font-mono text-xs font-semibold text-(--text-main)"
                >
                  ×{{ order.quantity || 1 }}
                </span>
              </div>
              <div
                class="mt-1.5 line-clamp-2 text-sm font-medium break-all text-(--text-main)"
                :title="order.productName || '—'"
              >
                {{ order.productName || '—' }}
              </div>
              <div class="mt-1 flex items-center gap-2 text-xs text-(--text-secondary)">
                <span v-if="order.customer?.name" class="flex min-w-0 items-center gap-1">
                  <AppIcon name="user" class="size-3" />
                  <span class="truncate" :title="order.customer.name">{{
                    order.customer.name
                  }}</span>
                </span>
                <span
                  v-if="order.brand"
                  class="max-w-[9rem] truncate rounded bg-(--bg-muted) px-1.5 py-0.5"
                  :title="order.brand"
                >
                  {{ order.brand }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <ActionBar>
        <template #leading>
          <span v-if="selected.length > 0" class="text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.selection.selectedCount', { count: selected.length }) }}
          </span>
        </template>
        <AppButton variant="secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </AppButton>
        <AppButton :disabled="selected.length === 0" @click="confirm">
          {{ t('common.confirm') }} ({{ selected.length }})
        </AppButton>
      </ActionBar>
    </template>
  </Modal>

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
import ActionBar from '@/design-system/composed/ActionBar.vue';
import StatePanel from '@/design-system/composed/StatePanel.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import OrderWorkflowModal from '@/components/order/OrderWorkflowModal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchInput from '@/components/ui/SearchInput.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  /** 控制弹窗可见性 */
  visible: { type: Boolean, default: false },
  /** 已经被选中的订单 ID (排除重复选择) */
  excludeIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'confirm']);

const { t } = useI18n();
const { loadOrders, orders, loading, getOrder, addComment } = useOrders();

const handleModalVisibilityChange = (nextVisible) => {
  if (!nextVisible) {
    emit('close');
  }
};

// ─── 状态 ────────────────────────────────────────────
const searchQuery = ref('');
const selected = ref([]);

const showDetailModal = ref(false);
const loadingDetail = ref(false);
const viewingOrder = ref(null);
const commenting = ref(false);
const detailError = ref('');
let detailRequestId = 0;

const invalidateDetailRequests = () => {
  detailRequestId += 1;
  loadingDetail.value = false;
};

const viewOrder = async (order) => {
  const requestId = ++detailRequestId;
  showDetailModal.value = true;
  loadingDetail.value = true;
  detailError.value = '';
  viewingOrder.value = order ? { ...order } : null;

  try {
    const fullOrder = await getOrder(order.id);
    if (requestId !== detailRequestId || !showDetailModal.value) return;
    if (fullOrder) {
      viewingOrder.value = fullOrder;
    } else {
      detailError.value = t('common.loadFailed');
    }
  } catch (_e) {
    if (requestId !== detailRequestId || !showDetailModal.value) return;
    detailError.value = t('common.networkError');
  } finally {
    if (requestId === detailRequestId) {
      loadingDetail.value = false;
    }
  }
};

const refreshOrderDetail = async () => {
  if (viewingOrder.value) {
    const requestId = ++detailRequestId;
    loadingDetail.value = true;
    detailError.value = '';
    try {
      const fullOrder = await getOrder(viewingOrder.value.id);
      if (requestId !== detailRequestId || !showDetailModal.value) return;
      if (fullOrder) {
        viewingOrder.value = fullOrder;
      } else {
        detailError.value = t('common.loadFailed');
      }
    } catch (_e) {
      if (requestId !== detailRequestId || !showDetailModal.value) return;
      detailError.value = t('common.networkError');
    } finally {
      if (requestId === detailRequestId) {
        loadingDetail.value = false;
      }
    }
  }
};

const closeDetail = () => {
  invalidateDetailRequests();
  showDetailModal.value = false;
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

const normalizeOrderProgressStatus = (order) =>
  String(
    order?.displayStatus ||
      order?.display_status ||
      order?.procurementStatus ||
      order?.procurement_status ||
      'none'
  )
    .trim()
    .toLowerCase();

const isOrderAvailableForProcurement = (order) => {
  const progressStatus = normalizeOrderProgressStatus(order);
  return !progressStatus || progressStatus === 'none';
};

// ─── 前端过滤 ────────────────────────────────────────
const filteredOrders = computed(() => {
  let list = orders.value || [];

  // 排除已在采购单中的订单
  if (props.excludeIds.length > 0) {
    const excludeSet = new Set(props.excludeIds);
    list = list.filter((o) => !excludeSet.has(o.id));
  }

  // 严格过滤仅已确认状态
  list = list.filter((o) => o.status === 'confirmed');

  // 在有进度字段时，隐藏已进入采购流程的订单
  list = list.filter(isOrderAvailableForProcurement);

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (o) =>
        (o.orderNo || '').toLowerCase().includes(q) ||
        (o.productName || '').toLowerCase().includes(q) ||
        (o.customer?.name || '').toLowerCase().includes(q)
    );
  }

  return list;
});

// ─── 全选逻辑 ────────────────────────────────────────
const filteredOrderIdSet = computed(() => new Set(filteredOrders.value.map((order) => order.id)));
const selectedOrderIdSet = computed(() => new Set(selected.value.map((order) => order.id)));

const selectedFilteredCount = computed(() =>
  filteredOrders.value.reduce(
    (count, order) => count + (selectedOrderIdSet.value.has(order.id) ? 1 : 0),
    0
  )
);

const isAllSelected = computed(
  () =>
    filteredOrders.value.length > 0 && selectedFilteredCount.value === filteredOrders.value.length
);
const isPartiallySelected = computed(
  () => selectedFilteredCount.value > 0 && selectedFilteredCount.value < filteredOrders.value.length
);

const isSelected = (id) => selected.value.some((o) => o.id === id);

const toggleSelect = (order) => {
  const idx = selected.value.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    selected.value.splice(idx, 1);
  } else {
    selected.value.push(order);
  }
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selected.value = selected.value.filter((order) => !filteredOrderIdSet.value.has(order.id));
  } else {
    const next = new Map(selected.value.map((order) => [order.id, order]));
    for (const order of filteredOrders.value) {
      next.set(order.id, order);
    }
    selected.value = Array.from(next.values());
  }
};

// ─── 确认操作 ────────────────────────────────────────
const confirm = () => {
  emit('confirm', [...selected.value]);
  emit('close');
};

// ─── 弹窗打开时加载数据 ─────────────────────────────
watch(
  () => props.visible,
  async (val) => {
    if (val) {
      selected.value = [];
      searchQuery.value = '';
      await loadOrders({ status: 'confirmed', limit: 100 });
    }
  }
);
</script>

<style scoped>
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}
.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--shimmer-from) 50%,
    transparent 100%
  );
  animation: shimmer 1.8s infinite;
}
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer::after {
    animation: none !important;
  }
}
</style>
