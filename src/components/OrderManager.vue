<template>
  <div class="flex flex-col gap-4 lg:h-full">
    <div v-if="errorCode === 'FORBIDDEN'" class="flex flex-1 items-center justify-center py-12">
      <PermissionDeniedState
        title="订单管理权限不足"
        :description="error || '当前账号没有订单读取权限，请联系管理员分配 orders:read。'"
        required-permission="orders:manage"
        @retry="refreshOrders"
      />
    </div>
    
    <!-- 订单统计仪表盘 (Desktop only inline) - NOTE: This seems unused or legacy comment, keeping structure but cleaning up -->
    
    <!-- Mobile Stats Modal -->
    <Modal v-if="errorCode !== 'FORBIDDEN'" v-model="showStatsModal" :title="t('dashboard.stats')" size="xl">
      <OrderDashboard @filter="(type) => { handleDashboardFilter(type); showStatsModal = false; }" />
    </Modal>

    <!-- 订单列表 -->
    <div v-if="errorCode !== 'FORBIDDEN'" class="lg:flex-1 lg:overflow-y-auto">
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
            <div class="flex flex-col items-center gap-1">
              <OrderStatusChanger
                :status="order.status"
                :loading="statusChanging[order.id]"
                :permissions="currentUser?.permissions || []"
                :on-status-change="(e) => handleStatusChange(order, e)"
              />
              <OrderProcurementBadge
                :status="order.procurementStatus"
                :show-label="false"
                compact
              />
            </div>
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
            <div class="flex flex-col items-end gap-1">
              <OrderStatusChanger
                :status="order.status"
                :loading="statusChanging[order.id]"
                :permissions="currentUser?.permissions || []"
                :on-status-change="(e) => handleStatusChange(order, e)"
              />
              <OrderProcurementBadge
                :status="order.procurementStatus"
                :show-label="false"
                compact
              />
            </div>
          </template>
        </OrderCards>
        <!-- Mobile Infinite Scroll Trigger -->
        <div class="mt-4 pb-20">
          <!-- Loading More Indicator -->
          <div v-if="mobileInfiniteScroll.isLoading.value" class="flex items-center justify-center py-4 text-sm text-(--text-secondary)">
            <AppIcon name="spinner" class="mr-2 size-5 animate-spin" />
            <span>{{ t('common.loadingMore') || '正在加载...' }}</span>
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

    <!-- Create Modal -->
    <OrderCreateModal
      v-if="errorCode !== 'FORBIDDEN' && showCreateModal"
      v-model="showCreateModal"
      :salespersons="salespersons"
      :statuses="statuses"
      @submit="handleCreateOrder"
    />

    <!-- 订单详情弹窗 -->
    <OrderWorkflowModal
      v-if="errorCode !== 'FORBIDDEN'"
      v-model:show="showDetailModal"
      :order="viewingOrder"
      :hydrating="detailHydrating"
      :hydration-error="detailHydrationError"
      :commenting="commenting"
      :edit-pending="detailEditLoading"
      @close="closeDetailModal"
      @retry="() => viewingOrder?.id && openDetailModal(viewingOrder)"
      @comment="handleAdminComment"
      @refresh="refreshAfterComment"
      @edit="handleEditFromDetail"
      @delete-order="() => showDeleteModal = true"
    />

    <!-- 订单编辑弹窗 -->
    <OrderEditModal
      v-if="errorCode !== 'FORBIDDEN' && showEditModal && editingOrder"
      :order="editingOrder"
      :submitting="isEditing"
      :statuses="statuses"
      :salespersons="salespersons"
      @close="closeEditModal"
      @submit="onEditSubmit"
    />
    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-if="errorCode !== 'FORBIDDEN'"
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />

    <!-- Destructive Delete Modal -->
    <DestructiveConfirmModal
      v-if="errorCode !== 'FORBIDDEN'"
      v-model="showDeleteModal"
      :title="t('order.detail.deletePermanently')"
      :description="t('order.detail.dangerWarning')"
      :required-text="viewingOrder?.orderNo || ''"
      :require-text-label="t('order.detail.typeOrderNoToConfirm', '输入订单号确认:')"
      :confirm-text="t('order.detail.deletePermanently')"
      :loading="isDeleting"
      @confirm="executeOrderDeletion(viewingOrder)"
    />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, onActivated, watch, reactive, ref } from 'vue';
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
import OrderStatusChanger from './OrderStatusChanger.vue';
import OrderProcurementBadge from './order/OrderProcurementBadge.vue';
import OrderEditModal from './OrderEditModal.vue';
import OrderWorkflowModal from './order/OrderWorkflowModal.vue';
import OrderDashboard from './order/OrderDashboard.vue';
import OrderCreateModal from '@/components/OrderCreateModal.vue';
import DestructiveConfirmModal from '@/components/common/DestructiveConfirmModal.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';

const {
  orders,
  salespersons,
  statuses,
  procurementStatuses,
  loading,
  error,
  errorCode,
  pagination,
  loadOrders,
  getOrder,
  updateOrder,
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
  confirmData,
  handleVoidOrder,
} = useOrderBatch(refreshOrders, batchAction, changeStatus);

// Status changing state (local UI state)
const statusChanging = reactive({});
const showDeleteModal = ref(false);
const isDeleting = ref(false);

const executeOrderDeletion = async (order) => {
  if (!order || isDeleting.value) return;
  isDeleting.value = true;
  try {
    const res = await authFetch(API.MANAGE_ORDER_UPDATE(order.id), {
      method: 'DELETE',
    }).then(r => r.json());

    if (res.success) {
      addToast({ message: res.message || t('order.detail.deleteSuccess', '订单彻底删除成功'), type: 'success' });
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
