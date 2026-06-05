<template>
  <div class="space-y-6">
    <!-- 无采购单读取权限时，直接展示权限说明并提供重试入口。 -->
    <div
      v-if="errorCode === ErrorCode.FORBIDDEN"
      class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-8"
    >
      <PermissionDeniedState
        :title="t('purchaseOrder.permissionDenied')"
        :description="error || t('purchaseOrder.permissionDeniedDesc')"
        home-to="/admin/forbidden"
        :home-text="t('common.viewDetails')"
        @retry="loadList"
      />
    </div>
    <template v-else>
      <!-- 列表页主壳：统一承载标题、操作区、内容区。 -->
      <ManagementListShell
        :title="t('purchaseOrder.title')"
        :description="t('purchaseOrder.subtitle')"
      >
        <template #actions>
          <!-- 顶部操作始终保持轻量，只暴露“建议”和“新建”两个主入口。 -->
          <AppButton
            variant="secondary"
            :text="t('purchaseOrder.action.viewSuggestions')"
            icon="light-bulb"
            @click="showSuggestions = true"
          />
          <AppButton
            variant="primary"
            data-testid="purchase-order-open-create"
            :text="t('purchaseOrder.action.create')"
            icon="plus"
            @click="showCreateModal = true"
          />
        </template>

        <template #content>
          <!-- 草稿恢复提示 -->
          <div
            v-if="hasPoDraft"
            class="flex items-center justify-between gap-3 rounded-xl border border-(--color-info-text)/20 bg-(--color-info-bg)/40 px-3 py-2"
            data-testid="po-draft-banner"
          >
            <p class="text-sm text-(--text-main)">
              {{ t('formDraft.poFound', '发现未保存的采购单草稿') }}
              <span v-if="getPoDraftAgeText()" class="text-(--text-secondary)">
                ({{ getPoDraftAgeText() }})
              </span>
            </p>
            <div class="flex items-center gap-2">
              <AppButton variant="ghost" size="sm" data-testid="po-draft-restore" @click="handleRestorePoDraft">
                {{ t('formDraft.restore', '恢复') }}
              </AppButton>
              <AppButton variant="ghost" size="sm" data-testid="po-draft-discard" @click="clearPoDraft">
                {{ t('formDraft.discard', '丢弃') }}
              </AppButton>
            </div>
          </div>

          <!-- 横幅区域负责展示统计、状态信号和快捷筛选。 -->
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

          <!-- 列表表格仅负责渲染与交互回调，格式化逻辑由 presentation/composable 注入。 -->
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

          <!-- 只有总数超过当前分页容量时才展示分页控制。 -->
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

          <!-- 详情抽屉：承载采购单生命周期中的大多数查看和变更动作。 -->
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

          <!-- 新建抽屉：独立于详情抽屉，避免创建态和编辑态互相污染。 -->
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

          <!-- 缺口关闭弹层：用于把剩余未到货数量显式关闭。 -->
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

          <!-- 收货弹层：对当前可收货条目做批量收货录入。 -->
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

          <!-- 成本弹层：维护币种、运费、关税和分摊方式。 -->
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

          <!-- 收货回滚弹层：只针对已记录的 receipt 做逆向撤销。 -->
          <Teleport to="body">
            <transition name="fade">
              <PurchaseOrderReceiptReversalModal
                :show="showReceiptReversalModal"
                :t="t"
                :active-receipt-for-reversal="activeReceiptForReversal"
                :reason="receiptReversalReason"
                :receipt-reversal-submitting="receiptReversalSubmitting"
                :format-integer="formatInteger"
                :format-date-time="formatDate"
                @close="closeReceiptReversalModal"
                @update:reason="receiptReversalReason = $event"
                @submit="submitReceiptReversal"
              />
            </transition>
          </Teleport>

          <!-- 辅助覆盖层集中承载产品详情、订单/商品选择器和缺口确认。 -->
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
// 这个页面本身只负责“编排”。
// 具体的数据读写、弹层状态、创建流程、展示映射都下沉到 composables / child components。
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

// 文件预览统一走公开文件路由，避免子组件各自拼接路径。
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
import { useFormDraft } from '@/composables/useFormDraft';
import { useAI } from '@/composables/useAI';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { CURRENCY_OPTIONS } from '@/constants/currency';
import { validateOrderQuantity } from '@/utils/purchase-order-constraints';
import {
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '@/utils/purchase-order-progress';
import { formatCurrency as formatMoney } from '@/utils/formatters';
import { formatDate } from "@/utils/formatters";
import {
  createReceiptMetaBuilder,
  hasReceiptMeta,
} from "@/views/purchase-orders/progress";
import {
  createPurchaseOrderSteps,
  getStepIconClasses,
  getStepperProgress,
  isStepCompleted,
} from "@/views/purchase-orders/stepper";
import {
  buildSuggestionMeta,
  buildSuggestionVariantLabel,
  getSuggestionOrderIds,
  isReceiptDraftInvalid,
  isShortageDraftInvalid,
  normalizeReceiptQty,
} from "@/views/purchase-orders/drafts";
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
import { ErrorCode } from '@/utils/error-codes';

// 页面级基础依赖：国际化、路由、toast、AI 上下文、刷新总线。
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

// 纯 UI/模态状态统一收拢在 modal composable，避免页面本体被局部开关淹没。
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

// 从详情抽屉跳商品详情时，只需要切换当前 product id。
const handleViewProductDetail = (id) => {
  viewProductId.value = id;
};

// 新建采购单的表单壳状态。
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

// 采购单草稿自动保存
const poDraftDataSource = reactive({
  get createForm() { return createForm; },
  get items() { return poItems; },
});

const {
  hasDraft: hasPoDraft,
  restoreDraft: restorePoDraft,
  clearDraft: clearPoDraft,
  getDraftAgeText: getPoDraftAgeText,
} = useFormDraft({
  key: 'purchase-order-create',
  data: poDraftDataSource,
  debounce: 2000,
  exclude: ['image'],
});

// 恢复草稿
const handleRestorePoDraft = () => {
  restorePoDraft();
  addToast({ message: t('formDraft.restored', '草稿已恢复'), type: 'success' });
};

// 列表展示层：负责把 stats/list 组织成卡片、列定义、控制台信号等 UI 友好数据。
const {
  statCards,
  columns,
  consoleSignals,
  buildReceiptProgressSummary,
  getListStatusVariant,
} = usePurchaseOrderListPresentation({ stats, t });

// 步骤条定义是静态结构，只依赖文案函数。
const stepsList = createPurchaseOrderSteps(t);

// 详情页状态推进统一从这里发起，成功后刷新列表和详情，避免局部状态漂移。
const handleStatusUpdate = async (newStatus) => {
  if (!detail.value) return;
  const success = await updateStatus(detail.value.id, newStatus);
  if (success) {
    await refreshPurchaseOrderViews(detail.value.id);
  }
};

// 下一可用状态由当前采购单状态和收货进度共同决定。
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

// 币种和分摊方式选项都来源于统一常量/国际化，避免子组件各自维护枚举。
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
  if (value === undefined || value === null || value === '') return '-';
  return formatMoney(value, currency || 'CNY');
};

// 收货元信息构建器负责把 receipt 历史整理成详情侧边栏可展示的数据。
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

// 收货/缺口关闭两个批量弹层都基于 draft 列表推导“已选择条目数”和“总数量”。
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

// 智能建议面板只关心建议集合和当前勾选项，汇总卡片在 presentation 层统一生成。
const { suggestionSummaryCards } = usePurchaseOrderSuggestionPresentation({
  suggestions,
  selectedSuggestions,
  t,
  formatInteger,
});

// 打开详情时先记录目标 id，再触发详情加载。
// detailRequestId 也会被重试、刷新和路由联动复用。
const openDetail = async (id) => {
  detailRequestId.value = String(id || '').trim();
  showDetail.value = true;
  await loadDetail(id);
};

// 分页切换时只修改 page，并复用同一套 loadList 查询。
const changePage = async (delta) => {
  const nextPage = Math.max(1, Number(filters.page || 1) + Number(delta || 0));
  if (nextPage === filters.page) return;
  filters.page = nextPage;
  await loadList();
};

// 点击状态卡时在“当前状态”和“全部状态”之间切换，并重置分页。
const toggleStatusFilter = async (status) => {
  filters.status = filters.status === status ? '' : status;
  filters.page = 1;
  await loadList();
};

// 详情重试优先使用当前记住的请求 id，其次回退到路由 query。
const retryDetail = async () => {
  const id = detailRequestId.value || String(route.query.id || '').trim();
  if (!id) return;
  await openDetail(id);
};

// 详情侧所有写操作都由 detail actions composable 接管：
// 成本设置、收货、缺口关闭、收货回滚都从这里暴露一致的状态和提交方法。
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

// 新建流程 composable 负责组装订单/商品选择结果，并统一处理“直接创建”和“从建议创建”。
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

// 详情抽屉需要的一组展示 helper 集中打包传入，避免子组件直接依赖页面外部实现。
const detailHelpers = {
  formatInteger,
  formatPurchaseCurrency,
  formatDate,
  formatDateTime: formatDate,
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

// 详情里的条目修改只允许发生在 draft 态，变更成功后强制刷新视图快照。
const handleDetailUpdateItem = async (itemId, field, value) => {
  if (!detail.value || detail.value.status !== 'draft') return;
  const success = await updateItem(detail.value.id, itemId, { [field]: value });
  if (success) {
    await refreshPurchaseOrderViews(detail.value.id);
  }
};

// 删除条目同样只允许在 draft 态下执行。
const handleDetailRemoveItem = async (itemId) => {
  if (!detail.value || detail.value.status !== 'draft') return;
  const success = await removeItem(detail.value.id, itemId);
  if (success) {
    await refreshPurchaseOrderViews(detail.value.id);
  }
};

// 页面挂载后订阅采购单模块刷新事件。
// 只有在未打开抽屉时才静默刷新 overview，避免打断用户正在编辑的上下文。
onMounted(() => {
  stopPurchaseOrdersRefreshSubscription = subscribeModule('purchaseOrders', async () => {
    if (!showCreateModal.value && !showDetail.value) {
      await loadPurchaseOrderOverview();
    }
  });
});

// keep-alive 激活时重新拉取概览。
// 如果 URL 上带了 id，则自动恢复详情抽屉。
onActivated(async () => {
  await loadPurchaseOrderOverview();

  if (route.query.id) {
    const targetId = route.query.id;
    openDetail(targetId);
  }
});

// 详情抽屉关闭时，负责清理路由 query 和各种明细弹层状态。
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

// 智能建议每次打开都重新清空勾选并拉取，关闭时也做清理，避免脏选择遗留。
watch(showSuggestions, (v) => {
  if (v) {
    selectedSuggestions.value = [];
    loadSuggestions();
    return;
  }
  selectedSuggestions.value = [];
});

// 采购单创建弹窗关闭时清除草稿（创建成功或取消后表单已被重置）
watch(showCreateModal, (isOpen) => {
  if (!isOpen && hasPoDraft.value) {
    clearPoDraft();
  }
});

const detailFocusedVariantId = computed(() => getDetailFocusedVariantId(detail.value));

// 把当前采购上下文同步到 AI：
// 商品选择器优先，其次是显式商品详情，再其次是详情抽屉聚焦的变体，最后才回退到路由 query。
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

// 页面失活时清空 AI 上下文，避免其它页面继承采购单的上下文对象。
onDeactivated(() => {
  setContext({
    selectedId: null,
    selectedType: null,
  });
});

// 页面销毁时显式退订刷新总线，避免重复订阅。
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
    animation: none;
    display: none;
  }
}

/* 侧滑动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* 淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
