<template>
  <div class="space-y-6">
    <div
      v-if="errorCode === 'FORBIDDEN'"
      class="rounded-xl border border-(--border-color) bg-(--bg-card) p-8"
    >
      <PermissionDeniedState
        title="采购单权限不足"
        :description="
          error || '当前账号没有采购单读取权限，请联系管理员分配 purchase_orders:read。'
        "
        home-to="/admin/forbidden"
        home-text="查看权限说明"
        @retry="loadList"
      />
    </div>
    <template v-else>
      <ManagementListShell
        :title="t('purchaseOrder.title')"
        :description="t('purchaseOrder.subtitle')"
      >
        <template #actions>
          <!-- 智能建议按钮 -->
          <AppButton
            variant="secondary"
            :text="t('purchaseOrder.action.viewSuggestions')"
            icon="light-bulb"
            @click="showSuggestions = true"
          />
          <!-- 新建按钮 -->
          <AppButton
            variant="primary"
            data-testid="purchase-order-open-create"
            :text="t('purchaseOrder.action.create')"
            icon="plus"
            @click="showCreateModal = true"
          />
        </template>

        <template #content>
          <PurchaseOrderOverviewBanner
            :title="t('purchaseOrder.title')"
            :description="t('purchaseOrder.subtitle')"
            :total="total"
            :loading="loading"
            :stats="stats"
            :stat-cards="statCards"
            :console-signals="consoleSignals"
            :active-status="filters.status"
            @toggle-status-filter="toggleStatusFilter"
          />

          <PurchaseOrderListTable
            :columns="columns"
            :list="list"
            :loading="loading"
            :empty-text="t('purchaseOrder.empty')"
            :status-config="statusConfig"
            :format-date="formatDate"
            :format-purchase-currency="formatPurchaseCurrency"
            :build-receipt-progress-summary="buildReceiptProgressSummary"
            :get-progress-status-label="getProgressStatusLabel"
            :get-progress-status-variant="getProgressStatusVariant"
            :get-list-status-variant="getListStatusVariant"
            @row-click="(row) => openDetail(row.id)"
          />

          <!-- 分页 -->
          <div
            v-if="total > filters.limit"
            class="flex items-center justify-between border-t border-(--border-color)/70 bg-(--bg-muted)/35 px-4 py-3"
          >
            <p class="text-sm text-(--text-secondary)">
              {{ t('purchaseOrder.pagination.total', { count: total }) }}
            </p>
            <div class="flex items-center gap-2">
              <AppButton
                variant="outline"
                size="sm"
                :disabled="filters.page <= 1"
                class="min-w-[5.5rem]"
                :text="`← ${t('purchaseOrder.pagination.prev')}`"
                @click="changePage(-1)"
              />
              <AppButton
                variant="outline"
                size="sm"
                :disabled="filters.page * filters.limit >= total"
                class="min-w-[5.5rem]"
                :text="`${t('purchaseOrder.pagination.next')} →`"
                @click="changePage(1)"
              />
            </div>
          </div>

          <!-- ==================== 详情面板 (弹窗) ==================== -->
          <Teleport to="body">
            <transition name="fade">
              <PurchaseOrderDetailDrawer
                :show="showDetail"
                :detail-loading="_detailLoading"
                :detail="detail"
                :status-config="statusConfig"
                :summary-cards="detailSummaryCards"
                :next-statuses="nextStatuses"
                :steps-list="stepsList"
                :receipt-timeline="receiptTimeline"
                :receipt-receivable-count="receiptReceivableCount"
                :can-record-receipts="canRecordReceipts"
                :can-close-shortages="canCloseShortages"
                :t="t"
                :helpers="detailHelpers"
                :get-file-url="getFileUrl"
                @close="showDetail = false"
                @retry-detail="retryDetail"
                @status-update="handleStatusUpdate"
                @open-cost-modal="openCostModal"
                @open-order-picker="openOrderPicker"
                @open-product-picker="openProductPicker"
                @view-product-detail="handleViewProductDetail"
                @update-item="handleDetailUpdateItem"
                @remove-item="handleDetailRemoveItem"
                @open-receipt-modal="openReceiptModal"
                @open-shortage-modal="openShortageModal"
                @open-reversal-modal="openReceiptReversalModal"
              />
            </transition>
          </Teleport>

          <!-- ==================== 新建采购单 Modal (增强版) ==================== -->
          <Teleport to="body">
            <transition name="fade">
              <PurchaseOrderCreateDrawer
                :show="showCreateModal"
                :t="t"
                :create-form="createForm"
                :currency-options="currencyOptions"
                :allocation-method-options="allocationMethodOptions"
                :po-items="poItems"
                :total-create-qty="totalCreateQty"
                :shortage-items="shortageItems"
                :get-file-url="getFileUrl"
                @close="showCreateModal = false"
                @update:create-form="Object.assign(createForm, $event)"
                @open-order-picker="openOrderPicker"
                @open-product-picker="openProductPicker"
                @remove-item="removePoItem"
                @submit="handleCreate"
              />
            </transition>
          </Teleport>

          <Teleport to="body">
            <transition name="fade">
              <PurchaseOrderShortageModal
                :show="showShortageClosureModal"
                :t="t"
                :shortage-drafts="shortageDrafts"
                :shortage-draft-selected-count="shortageDraftSelectedCount"
                :shortage-draft-selected-qty="shortageDraftSelectedQty"
                :shortage-submit-disabled="shortageSubmitDisabled"
                :shortage-submitting="shortageSubmitting"
                :format-integer="formatInteger"
                :is-shortage-draft-invalid="isShortageDraftInvalid"
                @close="closeShortageModal"
                @submit="submitShortageClosures"
              />
            </transition>
          </Teleport>

          <Teleport to="body">
            <transition name="fade">
              <PurchaseOrderReceiptModal
                :show="showReceiptModal"
                :t="t"
                :receipt-drafts="receiptDrafts"
                :receipt-draft-selected-count="receiptDraftSelectedCount"
                :receipt-draft-selected-qty="receiptDraftSelectedQty"
                :receipt-submit-disabled="receiptSubmitDisabled"
                :receipt-submitting="receiptSubmitting"
                :format-integer="formatInteger"
                :is-receipt-draft-invalid="isReceiptDraftInvalid"
                @close="closeReceiptModal"
                @submit="submitReceipts"
              />
            </transition>
          </Teleport>

          <Teleport to="body">
            <transition name="fade">
              <PurchaseOrderCostModal
                :show="showCostModal"
                :t="t"
                :cost-draft="costDraft"
                :currency-options="currencyOptions"
                :allocation-method-options="allocationMethodOptions"
                :cost-submitting="costSubmitting"
                :can-allocate-current-purchase-order="canAllocateCurrentPurchaseOrder"
                @close="closeCostModal"
                @update:cost-draft="Object.assign(costDraft, $event)"
                @save="saveCostSettings()"
                @allocate="saveCostSettings({ allocateAfterSave: true })"
              />
            </transition>
          </Teleport>

          <Teleport to="body">
            <transition name="fade">
              <PurchaseOrderReceiptReversalModal
                :show="showReceiptReversalModal"
                :t="t"
                :active-receipt-for-reversal="activeReceiptForReversal"
                :reason="receiptReversalReason"
                :receipt-reversal-submitting="receiptReversalSubmitting"
                :format-integer="formatInteger"
                :format-date-time="formatDateTime"
                @close="closeReceiptReversalModal"
                @update:reason="receiptReversalReason = $event"
                @submit="submitReceiptReversal"
              />
            </transition>
          </Teleport>

          <PurchaseOrderSupportOverlays
            :t="t"
            :view-product-id="viewProductId"
            :show-shortage-confirm="showShortageConfirm"
            :shortage-items="shortageItems"
            :show-order-picker="showOrderPicker"
            :exclude-order-ids="excludeOrderIds"
            :show-product-picker="showProductPicker"
            :existing-brands="existingBrands"
            :selected-variant-ids-for-picker="selectedVariantIdsForPicker"
            @close-product-detail="viewProductId = null"
            @close-shortage-confirm="showShortageConfirm = false"
            @confirm-shortage-create="executeCreate"
            @close-order-picker="showOrderPicker = false"
            @orders-selected="handleOrdersSelected"
            @close-product-picker="showProductPicker = false"
            @products-selected="handleProductsSelected"
          />

          <!-- ==================== 智能建议 Modal ==================== -->
          <Teleport to="body">
            <transition name="fade">
              <PurchaseOrderSuggestionsDrawer
                :show="showSuggestions"
                :t="t"
                :suggestions-loading="suggestionsLoading"
                :suggestions="suggestions"
                :suggestion-summary-cards="suggestionSummaryCards"
                :selected-suggestions="selectedSuggestions"
                :selected-suggestion-order-ids="selectedSuggestionOrderIds"
                :build-suggestion-meta="buildSuggestionMeta"
                :build-suggestion-variant-label="buildSuggestionVariantLabel"
                :get-suggestion-order-ids="getSuggestionOrderIds"
                @close="showSuggestions = false"
                @submit="handleCreateFromSuggestions"
                @update:selected-suggestions="selectedSuggestions = $event"
              />
            </transition>
          </Teleport>
        </template>
      </ManagementListShell>
    </template>
  </div>
</template>

<script setup>
import {
  ref,
  reactive,
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

const getFileUrl = (id) => `/file/${id}`;
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePurchaseOrders } from '@/composables/usePurchaseOrders';
import { usePurchaseOrderModals } from '@/composables/usePurchaseOrderModals';
import { usePurchaseOrderCreateFlow } from '@/composables/usePurchaseOrderCreateFlow';
import { usePurchaseOrderDetailActions } from '@/composables/usePurchaseOrderDetailActions';
import { usePurchaseOrderListPresentation } from '@/composables/usePurchaseOrderListPresentation';
import { usePurchaseOrderDetailPresentation } from '@/composables/usePurchaseOrderDetailPresentation';
import { usePurchaseOrderSuggestionPresentation } from '@/composables/usePurchaseOrderSuggestionPresentation';
import { useToast } from '@/composables/useToast';
import { useAI } from '@/composables/useAI';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { CURRENCY_OPTIONS } from '@/constants/currency.js';
import { validateOrderQuantity } from '@/utils/purchase-order-constraints';
import {
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '@/utils/purchase-order-progress';
import { formatCurrency as formatMoney } from '@/utils/formatters';
import { formatDate, formatDateTime } from "@/views/purchase-orders/formatters.js";
import {
  createReceiptMetaBuilder,
  hasReceiptMeta,
} from "@/views/purchase-orders/progress.js";
import {
  createPurchaseOrderSteps,
  getStepIconClasses,
  getStepperProgress,
  isStepCompleted,
} from "@/views/purchase-orders/stepper.js";
import {
  buildSuggestionMeta,
  buildSuggestionVariantLabel,
  getSuggestionOrderIds,
  isReceiptDraftInvalid,
  isShortageDraftInvalid,
  normalizeReceiptQty,
} from "@/views/purchase-orders/drafts.js";
import PurchaseOrderCostModal from '@/components/purchase-order/PurchaseOrderCostModal.vue';
import PurchaseOrderCreateDrawer from '@/components/purchase-order/PurchaseOrderCreateDrawer.vue';
import PurchaseOrderDetailDrawer from '@/components/purchase-order/PurchaseOrderDetailDrawer.vue';
import PurchaseOrderOverviewBanner from '@/components/purchase-order/PurchaseOrderOverviewBanner.vue';
import PurchaseOrderReceiptModal from '@/components/purchase-order/PurchaseOrderReceiptModal.vue';
import PurchaseOrderReceiptReversalModal from '@/components/purchase-order/PurchaseOrderReceiptReversalModal.vue';
import PurchaseOrderShortageModal from '@/components/purchase-order/PurchaseOrderShortageModal.vue';
import PurchaseOrderListTable from '@/components/purchase-order/PurchaseOrderListTable.vue';
import PurchaseOrderSuggestionsDrawer from '@/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue';
import PurchaseOrderSupportOverlays from '@/components/purchase-order/PurchaseOrderSupportOverlays.vue';
import AppButton from '@/components/ui/AppButton.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';

const { t } = useI18n();
const {
  list,
  total,
  loading,
  error,
  errorCode,
  detail,
  detailLoading: _detailLoading,
  suggestions,
  suggestionsLoading,
  stats,
  filters,
  statusConfig,
  loadList,
  loadDetail,
  loadPurchaseOrderOverview,
  refreshPurchaseOrderViews,
  createPO,
  createFromOrders,
  updatePO,
  updateStatus,
  loadSuggestions,
  addItems,
  removeItem,
  updateItem,
  recordReceipts,
  reverseReceipt,
  closeShortages,
  allocateCosts,
} = usePurchaseOrders();

const route = useRoute();
const router = useRouter();
const { addToast } = useToast();
const { setContext } = useAI();
const { subscribeModule } = useAppRefreshBus();

const {
  showDetail,
  showCreateModal,
  showSuggestions,
  showOrderPicker,
  showProductPicker,
  pickerTarget,
  showShortageConfirm,
  confirmData: _confirmData,
  viewProductId,
  detailFocusedVariantId: getDetailFocusedVariantId,
  openOrderPicker,
  openProductPicker,
} = usePurchaseOrderModals();

const handleViewProductDetail = (id) => {
  viewProductId.value = id;
};

// 复用常量与逻辑
const createForm = reactive({
  remark: '',
  currency: 'CNY',
  estimated_shipping_cost: 0,
  estimated_tariff_cost: 0,
  allocation_method: 'by_quantity',
});

const poItems = reactive([]);
const selectedSuggestions = ref([]);
const detailRequestId = ref('');
let stopPurchaseOrdersRefreshSubscription = null;

const {
  statCards,
  columns,
  consoleSignals,
  buildReceiptProgressSummary,
  getListStatusVariant,
} = usePurchaseOrderListPresentation({ stats, t });

const stepsList = createPurchaseOrderSteps(t);

const handleStatusUpdate = async (newStatus) => {
  if (!detail.value) return;
  const success = await updateStatus(detail.value.id, newStatus);
  if (success) {
    await refreshPurchaseOrderViews(detail.value.id);
  }
};

const nextStatuses = computed(() => {
  if (!detail.value) return [];
  if (detail.value.status === 'shipping') {
    return getPurchaseOrderOutstandingQty(detail.value) <= 0 ? ['arrived'] : [];
  }
  if (detail.value.status === 'ordered') {
    return getPurchaseOrderReceivedQty(detail.value) > 0 ? ['shipping'] : ['shipping', 'cancelled'];
  }
  const map = {
    draft: ['ordered', 'cancelled'],
    arrived: ['completed'],
  };
  return map[detail.value.status] || [];
});

const allocationMethodOptions = computed(() => [
  { value: 'by_quantity', label: t('purchaseOrder.form.byQuantity') },
  { value: 'by_value', label: t('purchaseOrder.form.byValue') },
]);

const currencyOptions = computed(() =>
  CURRENCY_OPTIONS.map((currency) => ({
    value: currency.code,
    label: `${currency.code} · ${currency.label}`,
  }))
);

const formatInteger = (value) => Number(value || 0).toLocaleString('zh-CN');

const formatPurchaseCurrency = (value, currency = 'CNY') => {
  if (value === undefined || value === null || value === '') return '—';
  return formatMoney(value, currency || 'CNY');
};

const buildReceiptMeta = createReceiptMetaBuilder({ t, formatDate });
const {
  detailSummaryCards,
  receiptTimeline,
  receiptCandidates,
  receiptReceivableCount,
  canRecordReceipts,
  shortageCandidates,
  canCloseShortages,
  getProgressStatusLabel,
  getProgressStatusVariant,
} = usePurchaseOrderDetailPresentation({
  detail,
  t,
  formatInteger,
  formatPurchaseCurrency,
  buildReceiptProgressSummary,
  buildReceiptMeta,
});

const receiptDraftSelectedCount = computed(
  () => receiptDrafts.value.filter((entry) => normalizeReceiptQty(entry.received_qty) > 0).length
);

const receiptDraftSelectedQty = computed(() =>
  receiptDrafts.value.reduce((sum, entry) => sum + normalizeReceiptQty(entry.received_qty), 0)
);

const receiptSubmitDisabled = computed(
  () =>
    receiptDraftSelectedCount.value === 0 ||
    receiptDrafts.value.some((entry) => isReceiptDraftInvalid(entry))
);

const shortageDraftSelectedCount = computed(
  () => shortageDrafts.value.filter((entry) => normalizeReceiptQty(entry.close_qty) > 0).length
);

const shortageDraftSelectedQty = computed(() =>
  shortageDrafts.value.reduce((sum, entry) => sum + normalizeReceiptQty(entry.close_qty), 0)
);

const shortageSubmitDisabled = computed(
  () =>
    shortageDraftSelectedCount.value === 0 ||
    shortageDrafts.value.some((entry) => isShortageDraftInvalid(entry))
);

const { suggestionSummaryCards } = usePurchaseOrderSuggestionPresentation({
  suggestions,
  selectedSuggestions,
  t,
  formatInteger,
});

const openDetail = async (id) => {
  detailRequestId.value = String(id || '').trim();
  showDetail.value = true;
  await loadDetail(id);
};

const changePage = async (delta) => {
  const nextPage = Math.max(1, Number(filters.page || 1) + Number(delta || 0));
  if (nextPage === filters.page) return;
  filters.page = nextPage;
  await loadList();
};

const toggleStatusFilter = async (status) => {
  filters.status = filters.status === status ? '' : status;
  filters.page = 1;
  await loadList();
};

const retryDetail = async () => {
  const id = detailRequestId.value || String(route.query.id || '').trim();
  if (!id) return;
  await openDetail(id);
};
const {
  showCostModal,
  costSubmitting,
  costDraft,
  showReceiptModal,
  receiptSubmitting,
  receiptDrafts,
  showShortageClosureModal,
  shortageSubmitting,
  shortageDrafts,
  showReceiptReversalModal,
  receiptReversalSubmitting,
  receiptReversalReason,
  activeReceiptForReversal,
  canAllocateCurrentPurchaseOrder,
  resetCostModalState,
  openCostModal,
  closeCostModal,
  saveCostSettings,
  resetReceiptModalState,
  openReceiptModal,
  closeReceiptModal,
  openShortageModal,
  closeShortageModal,
  submitReceipts,
  submitShortageClosures,
  canReverseReceipt,
  resetReceiptReversalState,
  openReceiptReversalModal,
  closeReceiptReversalModal,
  submitReceiptReversal,
} = usePurchaseOrderDetailActions({
  detail,
  t,
  addToast,
  updatePO,
  allocateCosts,
  recordReceipts,
  reverseReceipt,
  closeShortages,
  refreshPurchaseOrderViews,
  receiptCandidates,
  shortageCandidates,
  canRecordReceipts,
  canCloseShortages,
});

const {
  totalCreateQty,
  shortageItems,
  excludeOrderIds,
  selectedVariantIdsForPicker,
  existingBrands,
  selectedSuggestionOrderIds,
  handleOrdersSelected,
  handleProductsSelected,
  removePoItem,
  executeCreate,
  handleCreate,
  handleCreateFromSuggestions,
} = usePurchaseOrderCreateFlow({
  t,
  addToast,
  createForm,
  poItems,
  pickerTarget,
  detail,
  detailRequestId,
  showDetail,
  showCreateModal,
  showSuggestions,
  showShortageConfirm,
  selectedSuggestions,
  createPO,
  createFromOrders,
  addItems,
  removeItem,
  refreshPurchaseOrderViews,
  validateOrderQuantity,
});

const detailHelpers = {
  formatInteger,
  formatPurchaseCurrency,
  formatDateTime,
  getProgressStatusLabel,
  getProgressStatusVariant,
  buildReceiptProgressSummary,
  buildReceiptMeta,
  getStepperProgress,
  getStepIconClasses,
  isStepCompleted,
  hasReceiptMeta,
  canReverseReceipt,
};

const handleDetailUpdateItem = async (itemId, field, value) => {
  if (!detail.value || detail.value.status !== 'draft') return;
  const success = await updateItem(detail.value.id, itemId, { [field]: value });
  if (success) {
    await refreshPurchaseOrderViews(detail.value.id);
  }
};

const handleDetailRemoveItem = async (itemId) => {
  if (!detail.value || detail.value.status !== 'draft') return;
  const success = await removeItem(detail.value.id, itemId);
  if (success) {
    await refreshPurchaseOrderViews(detail.value.id);
  }
};

onMounted(() => {
  stopPurchaseOrdersRefreshSubscription = subscribeModule('purchaseOrders', async () => {
    if (!showCreateModal.value && !showDetail.value) {
      await loadPurchaseOrderOverview();
    }
  });
});

onActivated(async () => {
  await loadPurchaseOrderOverview();

  if (route.query.id) {
    const targetId = route.query.id;
    openDetail(targetId);
  }
});

watch(showDetail, (isOpen) => {
  if (!isOpen && route.query.id) {
    const newQuery = { ...route.query };
    delete newQuery.id;
    router.replace({ path: route.path, query: newQuery });
  }
  if (!isOpen) {
    resetCostModalState();
    resetReceiptModalState();
    resetReceiptReversalState();
  }
});

watch(showSuggestions, (v) => {
  if (v) {
    selectedSuggestions.value = [];
    loadSuggestions();
    return;
  }
  selectedSuggestions.value = [];
});

const detailFocusedVariantId = computed(() => getDetailFocusedVariantId(detail.value));

watch(
  [
    showProductPicker,
    selectedVariantIdsForPicker,
    viewProductId,
    showDetail,
    detailFocusedVariantId,
    () => route.query.variantId,
  ],
  ([pickerOpen, selectedVariantIds, productId, detailOpen, detailVariantId, routeVariantId]) => {
    if (pickerOpen) {
      setContext({
        selectedId: selectedVariantIds[0] || null,
        selectedType: 'variant',
      });
      return;
    }
    if (productId) {
      setContext({
        selectedId: productId,
        selectedType: 'product',
      });
      return;
    }
    if (detailOpen && detailVariantId) {
      setContext({
        selectedId: detailVariantId,
        selectedType: 'variant',
      });
      return;
    }
    if (typeof routeVariantId === 'string' && routeVariantId.trim()) {
      setContext({
        selectedId: routeVariantId.trim(),
        selectedType: 'variant',
      });
      return;
    }
    setContext({
      selectedId: null,
      selectedType: null,
    });
  }
);

onDeactivated(() => {
  setContext({
    selectedId: null,
    selectedType: null,
  });
});

onUnmounted(() => {
  stopPurchaseOrdersRefreshSubscription?.();
  stopPurchaseOrdersRefreshSubscription = null;
});
</script>

<style scoped>
/* 骨架屏 shimmer 动画 */
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
    rgba(255, 255, 255, 0.06) 50%,
    transparent 100%
  );
  animation: shimmer 1.8s infinite;
}
[data-theme='light'] .skeleton-shimmer::after {
  background: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.04) 50%, transparent 100%);
}
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer::after {
    animation: none;
    display: none;
  }
}

/* 侧滑动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* 淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
