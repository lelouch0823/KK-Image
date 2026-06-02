<template>
  <ManagementListShell :title="t('order.manage.title')" :description="t('order.manage.subtitle') || t('order.manage.title')">
    <div v-if="errorCode === ErrorCode.FORBIDDEN" class="flex flex-1 items-center justify-center py-12">
      <PermissionDeniedState
        :title="t('order.manage.permissionDenied')"
        :description="error || t('order.manage.permissionDeniedDesc')"
        required-permission="orders:manage"
        @retry="refreshOrders"
      />
    </div>
    
    <!-- 订单统计仪表盘 (Desktop only inline) - NOTE: This seems unused or legacy comment, keeping structure but cleaning up -->
    
    <!-- Mobile Stats Modal -->
    <Modal v-if="errorCode !== ErrorCode.FORBIDDEN" v-model="showStatsModal" :title="t('dashboard.stats')" size="xl">
      <OrderDashboard @filter="(type) => { handleDashboardFilter(type); showStatsModal = false; }" />
    </Modal>

    <!-- 订单列表 -->
    <template #content>
    <div v-if="errorCode !== ErrorCode.FORBIDDEN" class="lg:overflow-y-auto">
      <!-- 桌面表格视图 (lg+) -->
      <div class="hidden lg:block">
        <OrderTable
          v-model:selected-ids="selectedIds"
          :data="orders"
          :loading="loading"
          :selectable="true"
          @detail="openDetailModal"
          @edit="openEditModal"
          @void="handleVoidOrder"
        >
          <!-- Toolbar Slot: Filters -->
          <template #toolbar>
            <OrderFilters
              v-model:filters="filterState"
              :salespersons="salespersons"
              :statuses="statuses"
              :procurement-statuses="procurementStatuses"
              :delivery-statuses="deliveryStatuses"
              :exporting="exporting"
              :show-create="true"
              class="border-none bg-transparent p-0 shadow-none"
              @search="handleFilterChange"
              @export="exportOrders"
              @create="showCreateModal = true"
              @show-stats="showStatsModal = true" 
            />
          </template>

          <!-- Status Slot -->
          <template #status="{ order }">
            <OrderListStatusStack
              :status="order.status"
              :procurement-status="resolveOrderProgressStatus(order)"
              :delivery-status="resolveOrderDeliveryStatus(order)"
              :loading="statusChanging[order.id]"
              :permissions="currentUser?.permissions || []"
              :can-deliver="order.canDeliver"
              mode="manage"
              :on-status-change="(e) => handleStatusChange(order, e)"
            />
          </template>

          <!-- Footer Slot: Pagination -->
          <template #footer>
             <div class="flex w-full items-center justify-end gap-4">
                <span v-if="pagination.total > 0" class="text-sm text-(--text-secondary)">
                  {{ t('common.total') }} {{ pagination.total }}
                </span>
                <Pagination
                  v-if="pagination.totalPages > 1"
                  v-model:current-page="pagination.page"
                  :total-pages="pagination.totalPages"
                  @change="changePage"
                />
             </div>
          </template>
        </OrderTable>
      </div>

      <!-- 移动端卡片视图 (<lg) -->
      <div class="h-full overflow-y-auto p-4 lg:hidden">
         <!-- Mobile view needs its own filters since it doesn't use OrderTable -->
         <OrderFilters
              v-model:filters="filterState"
              :salespersons="salespersons"
              :statuses="statuses"
              :procurement-statuses="procurementStatuses"
              :delivery-statuses="deliveryStatuses"
              :exporting="exporting"
              :show-create="true"
              class="mb-4"
              @search="handleFilterChange"
              @export="exportOrders"
              @create="showCreateModal = true"
              @show-stats="showStatsModal = true"
         />
        <OrderCards
          :data="orders"
          :loading="loading"
          @detail="openDetailModal"
          @edit="openEditModal"
        >
          <template #status="{ order }">
            <OrderListStatusStack
              :status="order.status"
              :procurement-status="resolveOrderProgressStatus(order)"
              :delivery-status="resolveOrderDeliveryStatus(order)"
              :loading="statusChanging[order.id]"
              :permissions="currentUser?.permissions || []"
              :can-deliver="order.canDeliver"
              mode="manage"
              :on-status-change="(e) => handleStatusChange(order, e)"
            />
          </template>
        </OrderCards>
        <!-- Mobile Infinite Scroll Trigger -->
        <div class="mt-4 pb-20">
          <!-- Loading More Indicator -->
          <div v-if="mobileInfiniteScroll.isLoading.value" class="flex items-center justify-center py-4 text-sm text-(--text-secondary)">
            <AppIcon name="spinner" class="mr-2 size-5 animate-spin" />
            <span>{{ t('common.loadingMore') }}</span>
          </div>
          <!-- Intersection Observer Trigger -->
          <div 
            v-else-if="mobileInfiniteScroll.canLoadMore.value"
            :ref="(el) => mobileInfiniteScroll.triggerRef.value = el"
            class="h-10 w-full"
          ></div>
          <!-- End of List -->
          <div v-else-if="orders.length > 0" class="py-4 text-center text-sm text-(--text-secondary)">
            {{ t('common.total') }} {{ pagination.total }} {{ t('common.items') }}
          </div>
        </div>
      </div>
    </div>
    </template>

    <!-- Create Modal -->
    <OrderCreateModal
      v-if="errorCode !== ErrorCode.FORBIDDEN && showCreateModal"
      v-model="showCreateModal"
      :salespersons="salespersons"
      :statuses="statuses"
      @submit="handleCreateOrder"
    />

    <!-- 订单详情弹窗 -->
    <OrderWorkflowModal
      v-if="errorCode !== ErrorCode.FORBIDDEN"
      v-model:show="showDetailModal"
      :order="viewingOrder"
      :hydrating="detailHydrating"
      :hydration-error="detailHydrationError"
      :commenting="commenting"
      :line-command-state="lineCommandState"
      :delivery-confirm-pending="deliveryConfirm.pending"
      :edit-pending="detailEditLoading"
      @close="closeDetailModal"
      @retry="() => viewingOrder?.id && openDetailModal(viewingOrder)"
      @comment="handleAdminComment"
      @refresh="refreshAfterComment"
      @edit="handleEditFromDetail"
      @delete-order="() => showDeleteModal = true"
      @line-command="handleOrderLineCommand"
      @confirm-delivery="openDeliveryConfirm"
    />

    <!-- 订单编辑弹窗 -->
    <OrderEditModal
      v-if="errorCode !== ErrorCode.FORBIDDEN && showEditModal && editingOrder"
      :order="editingOrder"
      :submitting="isEditing"
      :statuses="statuses"
      :salespersons="salespersons"
      @close="closeEditModal"
      @submit="onEditSubmit"
    />
    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-if="errorCode !== ErrorCode.FORBIDDEN"
      v-model="lineCommandConfirm.show"
      :title="lineCommandConfirm.title"
      :message="lineCommandConfirm.message"
      :confirm-text="lineCommandConfirm.confirmText"
      :type="lineCommandConfirm.type"
      :loading="lineCommandState.pending"
      @confirm="confirmLineCommand"
      @cancel="cancelLineCommandConfirm"
    />

    <ConfirmDialog
      v-if="errorCode !== ErrorCode.FORBIDDEN"
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />

    <ConfirmDialog
      v-if="errorCode !== ErrorCode.FORBIDDEN"
      v-model="deliveryConfirm.show"
      :title="deliveryConfirm.title"
      :message="deliveryConfirm.message"
      :confirm-text="deliveryConfirm.confirmText"
      :type="deliveryConfirm.type"
      :loading="deliveryConfirm.pending"
      @confirm="confirmDelivery"
      @cancel="cancelDeliveryConfirm"
    />

    <OrderReturnDialog
      v-if="errorCode !== ErrorCode.FORBIDDEN"
      v-model="returnDialog.show"
      :quantity="returnDialog.quantity"
      :line-label="returnDialog.lineLabel"
      :loading="returnDialog.pending"
      @confirm="confirmReturn"
      @cancel="cancelReturnDialog"
    />

    <!-- Destructive Delete Modal -->
    <DestructiveConfirmModal
      v-if="errorCode !== ErrorCode.FORBIDDEN"
      v-model="showDeleteModal"
      :title="t('order.detail.deletePermanently')"
      :description="t('order.detail.dangerWarning')"
      :required-text="viewingOrder?.orderNo || ''"
      :require-text-label="t('order.detail.typeOrderNoToConfirm', { orderNo: viewingOrder?.orderNo || '' })"
      :confirm-text="t('order.detail.deletePermanently')"
      :loading="isDeleting"
      @confirm="executeOrderDeletion(viewingOrder)"
    />

    <!-- 批量操作浮动栏 -->
    <OrderBatchActions
      v-if="errorCode !== ErrorCode.FORBIDDEN"
      :selected-count="selectedIds.length"
      :processing="batchProcessing"
      :exporting="batchExporting"
      :statuses="statuses"
      @cancel="selectedIds = []"
      @action="handleBatchAction"
      @change-status="handleBatchChangeStatus"
    />
  </ManagementListShell>
</template>

<script setup>
import { onMounted, onUnmounted, onActivated, watch, reactive, ref, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useOrders } from '@/composables/useOrders';
import { useNotifications } from '@/composables/useNotifications';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { useI18n } from '@/composables/useI18n';
import { useAI } from '@/composables/useAI';
import { useOrderFilters } from '@/composables/order/useOrderFilters';
import { useOrderModals } from '@/composables/order/useOrderModals';
import { useOrderBatch } from '@/composables/order/useOrderBatch';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';

// Components
import Pagination from '@/components/ui/Pagination.vue';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import OrderFilters from './order/OrderFilters.vue';
import OrderTable from './order/OrderTable.vue';
import OrderCards from './order/OrderCards.vue';
import OrderListStatusStack from './order/OrderListStatusStack.vue';
import OrderBatchActions from './order/OrderBatchActions.vue';
const OrderEditModal = defineAsyncComponent(() => import('./OrderEditModal.vue'));
const OrderWorkflowModal = defineAsyncComponent(() => import('./order/OrderWorkflowModal.vue'));
const OrderReturnDialog = defineAsyncComponent(() => import('./order/OrderReturnDialog.vue'));
const OrderDashboard = defineAsyncComponent(() => import('./order/OrderDashboard.vue'));
const OrderCreateModal = defineAsyncComponent(() => import('@/components/OrderCreateModal.vue'));
const DestructiveConfirmModal = defineAsyncComponent(() => import('@/components/common/DestructiveConfirmModal.vue'));
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';
import { resolveOrderDeliveryStatus, resolveOrderProgressStatus } from '@/utils/order-display';
import { ErrorCode } from '@/utils/error-codes';

const {
  orders,
  salespersons,
  statuses,
  procurementStatuses,
  deliveryStatuses,
  loading,
  error,
  errorCode,
  pagination,
  loadOrders,
  getOrder,
  updateOrder,
  reserveOrderLine,
  releaseOrderLine,
  shipOrderLine,
  unshipOrderLine,
  returnOrderLine,
  confirmOrderDelivery,
  changeStatus,
  addComment,
  batchAction,
} = useOrders();

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch, currentUser } = useAuth();
const route = useRoute();
const router = useRouter();
const { setContext } = useAI();

useNotifications();
const { subscribeModule } = useAppRefreshBus();
let stopOrdersRefreshSubscription = null;

// Initialize Composables
const {
  filterState,
  exporting,
  handleFilterChange,
  handleDashboardFilter,
  exportOrders,
  refreshOrders,
  finishInitialization,
} = useOrderFilters(loadOrders);

const {
  showCreateModal,
  showEditModal,
  showDetailModal,
  showStatsModal,
  editingOrder,
  viewingOrder,
  detailHydrating,
  detailHydrationError,
  detailEditLoading,
  isEditing,
  handleCreateOrder,
  openEditModal,
  closeEditModal,
  handleEditSubmit,
  openDetailModal,
  closeDetailModal,
  handleAdminComment,
  refreshAfterComment,
  handleEditFromDetail,
  commenting,
} = useOrderModals(orders, refreshOrders, getOrder, updateOrder, addComment);

const {
  selectedIds,
  batchProcessing,
  batchExporting,
  confirmData,
  handleBatchAction,
  handleBatchChangeStatus,
  handleVoidOrder,
} = useOrderBatch(refreshOrders, batchAction, changeStatus, getOrder);

// Status changing state (local UI state)
const statusChanging = reactive({});
const showDeleteModal = ref(false);
const isDeleting = ref(false);
const lineCommandState = reactive({
  pending: false,
  lineId: null,
  action: '',
  error: '',
});
const lineCommandConfirm = reactive({
  show: false,
  lineId: null,
  action: '',
  quantity: 0,
  title: '',
  message: '',
  confirmText: '',
  type: 'primary',
});
const deliveryConfirm = reactive({
  show: false,
  pending: false,
  note: '',
  title: '',
  message: '',
  confirmText: '',
  type: 'primary',
});
const returnDialog = reactive({
  show: false,
  pending: false,
  lineId: null,
  quantity: 0,
  lineLabel: '',
});

const refreshViewingOrder = async () => {
  if (!viewingOrder.value?.id) return null;
  const fullOrder = await getOrder(viewingOrder.value.id);
  if (fullOrder) {
    viewingOrder.value = fullOrder;
  }
  return fullOrder;
};

const lineCommandExecutors = {
  reserve: reserveOrderLine,
  release: releaseOrderLine,
  ship: shipOrderLine,
  unship: unshipOrderLine,
  return: returnOrderLine,
};

function openDeliveryConfirm(payload = {}) {
  if (!viewingOrder.value?.id || deliveryConfirm.pending) return false;

  deliveryConfirm.show = true;
  deliveryConfirm.note = String(payload?.note || '').trim();
  deliveryConfirm.title = t('order.detail.deliveryConfirmTitle');
  deliveryConfirm.message = t(
    'order.detail.deliveryConfirmMessage',
  );
  deliveryConfirm.confirmText = t('order.detail.deliveryConfirmAction');
  deliveryConfirm.type = 'primary';
  return true;
}

function cancelDeliveryConfirm() {
  deliveryConfirm.show = false;
  deliveryConfirm.pending = false;
  deliveryConfirm.note = '';
  deliveryConfirm.title = '';
  deliveryConfirm.message = '';
  deliveryConfirm.confirmText = '';
  deliveryConfirm.type = 'primary';
}

function openLineCommandConfirm({ line, lineId, action, quantity }) {
  const lineLabel = String(line?.snapshotName || line?.id || lineId || '').trim();
  const actionConfig = {
    reserve: {
      title: t('order.detail.reserveConfirmTitle'),
      message: t('order.detail.reserveConfirmMessage', {
        quantity,
        lineLabel: lineLabel || lineId,
      }),
      confirmText: t('order.detail.reserveAction'),
      type: 'primary',
    },
    release: {
      title: t('order.detail.releaseConfirmTitle'),
      message: t('order.detail.releaseConfirmMessage', {
        quantity,
        lineLabel: lineLabel || lineId,
      }),
      confirmText: t('order.detail.releaseAction'),
      type: 'primary',
    },
    ship: {
      title: t('order.detail.shipConfirmTitle'),
      message: t('order.detail.shipConfirmMessage', {
        quantity,
        lineLabel: lineLabel || lineId,
      }),
      confirmText: t('order.detail.shipAction'),
      type: 'warning',
    },
    unship: {
      title: t('order.detail.unshipConfirmTitle'),
      message: t('order.detail.unshipConfirmMessage', {
        quantity,
        lineLabel: lineLabel || lineId,
      }),
      confirmText: t('order.detail.unshipAction'),
      type: 'warning',
    },
    return: {
      title: t('order.detail.returnConfirmTitle'),
      message: t('order.detail.returnConfirmMessage', {
        quantity,
        lineLabel: lineLabel || lineId,
      }),
      confirmText: t('order.detail.returnAction'),
      type: 'warning',
    },
  };
  const config = actionConfig[action];
  if (!config) return false;

  lineCommandConfirm.show = true;
  lineCommandConfirm.lineId = lineId;
  lineCommandConfirm.action = action;
  lineCommandConfirm.quantity = quantity;
  lineCommandConfirm.title = config.title;
  lineCommandConfirm.message = config.message;
  lineCommandConfirm.confirmText = config.confirmText;
  lineCommandConfirm.type = config.type;
  return true;
}

function cancelLineCommandConfirm() {
  lineCommandConfirm.show = false;
  lineCommandConfirm.lineId = null;
  lineCommandConfirm.action = '';
  lineCommandConfirm.quantity = 0;
  lineCommandConfirm.title = '';
  lineCommandConfirm.message = '';
  lineCommandConfirm.confirmText = '';
  lineCommandConfirm.type = 'primary';
}

function openReturnDialog({ line, lineId, quantity }) {
  returnDialog.show = true;
  returnDialog.pending = false;
  returnDialog.lineId = lineId;
  returnDialog.quantity = quantity;
  returnDialog.lineLabel = String(line?.snapshotName || line?.id || lineId || '').trim();
  return true;
}

function cancelReturnDialog() {
  returnDialog.show = false;
  returnDialog.pending = false;
  returnDialog.lineId = null;
  returnDialog.quantity = 0;
  returnDialog.lineLabel = '';
}

const handleOrderLineCommand = async ({ lineId, action, quantity }) => {
  if (!viewingOrder.value?.id || lineCommandState.pending) return false;

  const executor = lineCommandExecutors[action];
  if (typeof executor !== 'function') return false;
  const line = Array.isArray(viewingOrder.value?.lines)
    ? viewingOrder.value.lines.find((item) => item?.id === lineId)
    : null;

  if (line && !line.variantId) {
    lineCommandState.pending = false;
    lineCommandState.lineId = lineId;
    lineCommandState.action = action;
    lineCommandState.error = t('order.detail.lineCommandVariantRequired');
    return false;
  }

  lineCommandState.error = '';
  if (action === 'return') {
    return openReturnDialog({ line, lineId, quantity });
  }
  return openLineCommandConfirm({ line, lineId, action, quantity });
};

const confirmLineCommand = async () => {
  if (!viewingOrder.value?.id || lineCommandState.pending) return false;

  const { lineId, action, quantity } = lineCommandConfirm;
  const executor = lineCommandExecutors[action];
  if (!lineId || !action || typeof executor !== 'function') return false;

  cancelLineCommandConfirm();
  lineCommandState.pending = true;
  lineCommandState.lineId = lineId;
  lineCommandState.action = action;
  lineCommandState.error = '';

  let success = false;
  try {
    success = await executor(viewingOrder.value.id, lineId, quantity);
    if (!success) {
      lineCommandState.error = t('order.detail.lineCommandFailed');
      return false;
    }

    await refreshViewingOrder();
    refreshOrders(pagination.page);
    lineCommandState.lineId = null;
    lineCommandState.action = '';
    lineCommandState.error = '';
    return true;
  } finally {
    lineCommandState.pending = false;
  }
};

const confirmDelivery = async () => {
  if (!viewingOrder.value?.id || deliveryConfirm.pending) return false;

  const orderId = viewingOrder.value.id;
  const note = deliveryConfirm.note;
  deliveryConfirm.pending = true;

  try {
    const success = await confirmOrderDelivery(orderId, note);
    if (!success) return false;

    cancelDeliveryConfirm();
    await refreshViewingOrder();
    refreshOrders(pagination.page);
    return true;
  } finally {
    deliveryConfirm.pending = false;
  }
};

const confirmReturn = async ({ reason, note }) => {
  if (!viewingOrder.value?.id || !returnDialog.lineId || returnDialog.pending) return false;

  const orderId = viewingOrder.value.id;
  const lineId = returnDialog.lineId;
  const quantity = returnDialog.quantity;
  returnDialog.pending = true;
  lineCommandState.pending = true;
  lineCommandState.lineId = lineId;
  lineCommandState.action = 'return';
  lineCommandState.error = '';

  try {
    const success = await returnOrderLine(orderId, lineId, {
      quantity,
      reason,
      note,
    });
    if (!success) {
      lineCommandState.error = t('order.detail.lineCommandFailed');
      return false;
    }

    cancelReturnDialog();
    await refreshViewingOrder();
    refreshOrders(pagination.page);
    lineCommandState.lineId = null;
    lineCommandState.action = '';
    lineCommandState.error = '';
    return true;
  } finally {
    returnDialog.pending = false;
    lineCommandState.pending = false;
  }
};

const executeOrderDeletion = async (order) => {
  if (!order || isDeleting.value) return;
  isDeleting.value = true;
  try {
    const res = await authFetch(API.MANAGE_ORDER_UPDATE(order.id), {
      method: 'DELETE',
    }).then(r => r.json());

    if (res.success) {
      addToast({ message: res.message || t('order.detail.deleteSuccess'), type: 'success' });
      showDeleteModal.value = false;
      closeDetailModal();
      refreshOrders();
    } else {
      addToast({ message: res.error || res.message || t('common.operationFailed'), type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    isDeleting.value = false;
  }
};

// Mobile infinite scroll using composable
const mobileInfiniteScroll = useInfiniteScroll(async () => {
  if (loading.value) return;
  if (pagination.page >= pagination.totalPages) {
    mobileInfiniteScroll.setCanLoadMore(false);
    return;
  }
  // Pass append = true to add items instead of replacing
  await loadOrders({ page: pagination.page + 1 }, true);
  // Update canLoadMore based on new pagination state
  mobileInfiniteScroll.setCanLoadMore(pagination.page < pagination.totalPages);
});

// Wrappers to inject pagination
const onEditSubmit = (payload) => handleEditSubmit(payload, pagination.page);

// SOTA: 监听路由 query 中 salesperson 参数变化，响应从销售管理跳转过来的筛选
watch(
  () => route.query.salesperson,
  (newVal) => {
    // 更新筛选状态
    filterState.value.salesperson = newVal || '';
    // 刷新订单列表
    refreshOrders();
  }
);

// SOTA: 监听路由 query 中 id 参数变化，响应从通知中心跳转过来的定位
watch(
  () => route.query.id,
  async (newId) => {
    if (newId) {
      await openDetailModal({ id: newId });
    }
  },
  { immediate: true }
);

// SOTA: 当弹窗关闭时，自动清理 URL 中的 id 参数，保持状态干净
watch(showDetailModal, (isOpen) => {
  if (!isOpen && route.query.id) {
    const query = { ...route.query };
    delete query.id;
    router.replace({ query });
  }
});

watch([showDetailModal, viewingOrder], ([isOpen, order]) => {
  if (isOpen && order?.id) {
    setContext({
      selectedId: order.id,
      selectedType: 'order',
    });
    return;
  }
  setContext({
    selectedId: null,
    selectedType: null,
  });
});

// Lifecycle
onMounted(() => {
  stopOrdersRefreshSubscription = subscribeModule('orders', () => {
    if (!showEditModal.value && !showDetailModal.value && !showCreateModal.value) {
      refreshOrders();
    }
  });

  // 从 URL 参数读取销售筛选 (从销售管理页面跳转过来)
  const salespersonParam = route.query.salesperson;
  if (salespersonParam) {
    filterState.value.salesperson = salespersonParam;
  }

  // 使用 refreshOrders以确保应用所有当前筛选条件
  refreshOrders();
  // 初始化完成后允许 watch 监听后续变化
  finishInitialization();
});

onActivated(() => {
  refreshOrders();
});

// Pagination change
const changePage = (page) => {
  refreshOrders(page);
};

// Status Change Handler (Local wrapper)
const handleStatusChange = async (order, { status, note, force }) => {
  statusChanging[order.id] = true;
  try {
    const success = await changeStatus(order.id, status, note, force);
    if (success) {
      if (filterState.value.status && filterState.value.status !== status) {
        handleFilterChange();
      } else {
        order.status = status;
      }
    }
  } finally {
    statusChanging[order.id] = false;
  }
};
onUnmounted(() => {
  // 清理局部 UI 状态
  Object.keys(statusChanging).forEach(key => delete statusChanging[key]);
  stopOrdersRefreshSubscription?.();
  stopOrdersRefreshSubscription = null;
});
</script>
