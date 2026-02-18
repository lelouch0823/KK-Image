<template>
  <div
    class="flex flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] backdrop-blur-sm transition-all duration-500 lg:h-full"
  >
    <!-- 头部操作栏 -->
    <OrderFilters
      v-model:filters="filterState"
      :salespersons="salespersons"
      :statuses="statuses"
      :exporting="exporting"
      :show-create="true"
      @search="handleFilterChange"
      @export="exportOrders"
      @create="showCreateModal = true"
      @show-stats="showStatsModal = true"
    />

    <!-- 订单统计仪表盘 (Desktop only inline) -->


    <!-- Mobile Stats Modal -->
    <!-- Stats Modal -->
    <Modal v-model="showStatsModal" :title="t('dashboard.stats')">
      <OrderDashboard @filter="(type) => { handleDashboardFilter(type); showStatsModal = false; }" />
    </Modal>

    <!-- 订单列表 -->
    <div class="lg:flex-1 lg:overflow-auto">
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
          <template #status="{ order }">
            <OrderStatusChanger
              :status="order.status"
              :loading="statusChanging[order.id]"
              @change="(e) => handleStatusChange(order, e)"
            />
          </template>
        </OrderTable>
      </div>

      <!-- 移动端卡片视图 (<lg) -->
      <div class="p-4 lg:hidden">
        <OrderCards
          :data="orders"
          :loading="loading"
          @detail="openDetailModal"
          @edit="openEditModal"
        >
          <template #status="{ order }">
            <OrderStatusChanger
              :status="order.status"
              :loading="statusChanging[order.id]"
              @change="(e) => handleStatusChange(order, e)"
            />
          </template>
        </OrderCards>
      </div>
    </div>

    <!-- 批量操作浮动栏 -->
    <OrderBatchActions
      :selected-count="selectedIds.length"
      :processing="batchProcessing"
      @action="onBatchAction"
      @cancel="selectedIds = []"
    />

    <!-- 分页 -->
    <div
      v-if="pagination.totalPages > 1"
      class="flex-shrink-0 border-t border-[var(--border-color)] p-4"
    >
      <Pagination
        v-model:current-page="pagination.page"
        :total-pages="pagination.totalPages"
        @change="changePage"
      />
    </div>

    <!-- Create Modal -->
    <OrderCreateModal
      v-if="showCreateModal"
      v-model="showCreateModal"
      :salespersons="salespersons"
      :statuses="statuses"
      @submit="handleCreateOrder"
    />

    <!-- 订单详情弹窗 -->
    <Modal v-model="showDetailModal" size="6xl">
       <template #header>
        <div class="flex items-center gap-4">
          <h3 class="text-lg font-semibold text-[var(--text-main)]">{{ t('order.detail.title') }}</h3>
          <div class="flex items-center gap-2">
            <!-- Edit Button -->
            <button
               class="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white"
               @click="handleEditFromDetail(viewingOrder)"
            >
               <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
               </svg>
               {{ t('order.manage.editOrder') }}
            </button>
            <!-- Save PDF Button -->
            <button
               class="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--color-primary)]"
               @click="detailRef?.handleSavePdf()"
            >
               <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
               </svg>
               {{ t('common.savePdf') }}
            </button>
          </div>
        </div>
      </template>
      <OrderDetail
        v-if="viewingOrder"
        ref="detailRef"
        :order="viewingOrder"
        mode="admin"
        @back="closeDetailModal"
        @comment="handleAdminComment"
        @refresh="refreshAfterComment"
        @edit="handleEditFromDetail"
      />
    </Modal>

    <!-- 订单编辑弹窗 -->
    <OrderEditModal
      v-if="showEditModal && editingOrder"
      :order="editingOrder"
      :submitting="isEditing"
      :statuses="statuses"
      @close="closeEditModal"
      @submit="onEditSubmit"
    />
    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { onMounted, onActivated, watch, reactive } from 'vue';
import { useOrders } from '@/composables/useOrders';
import { useNotifications } from '@/composables/useNotifications';
import { useI18n } from '@/composables/useI18n';
import { useOrderFilters } from '@/composables/order/useOrderFilters';
import { useOrderModals } from '@/composables/order/useOrderModals';
import { useOrderBatch } from '@/composables/order/useOrderBatch';

// Components
import Pagination from '@/components/ui/Pagination.vue';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import OrderFilters from './order/OrderFilters.vue';
import OrderBatchActions from './order/OrderBatchActions.vue';
import OrderTable from './order/OrderTable.vue';
import OrderCards from './order/OrderCards.vue';
import OrderStatusChanger from './OrderStatusChanger.vue';
import OrderEditModal from './OrderEditModal.vue';
import OrderDetail from './order/OrderDetail.vue';
import OrderDashboard from './order/OrderDashboard.vue';
import OrderCreateModal from '@/components/OrderCreateModal.vue';

const {
  orders,
  salespersons,
  statuses,
  loading,
  pagination,
  loadOrders,
  getOrder,
  updateOrder,
  changeStatus,
  addComment,
  batchAction,
} = useOrders();

const { t } = useI18n();

// SOTA: Auto-refresh on notification
const { lastNotificationTime } = useNotifications();

// Initialize Composables
// Initialize Composables
const {
  filterState,
  filterDateRange,
  exporting,
  handleFilterChange,
  handleDashboardFilter,
  exportOrders,
  refreshOrders,
} = useOrderFilters(loadOrders);

const {
  showCreateModal,
  showEditModal,
  showDetailModal,
  showStatsModal,
  editingOrder,
  viewingOrder,
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
} = useOrderModals(orders, refreshOrders, getOrder, updateOrder, addComment);

const {
  selectedIds,
  batchProcessing,
  confirmData,
  handleBatchAction,
  handleVoidOrder,
} = useOrderBatch(refreshOrders, batchAction, changeStatus);

// Status changing state (local UI state)
const statusChanging = reactive({});

// Wrappers to inject pagination
const onEditSubmit = (payload) => handleEditSubmit(payload, pagination.page);
const onBatchAction = (action) => handleBatchAction(action, pagination.page);

// Watch for notifications to auto-refresh
watch(lastNotificationTime, () => {
  // Only refresh if not editing or viewing detail to avoid disruption
  if (!showEditModal.value && !showDetailModal.value && !showCreateModal.value) {
    loadOrders({ page: pagination.page });
  }
});

// Lifecycle
onMounted(() => {
  loadOrders();
});

onActivated(() => {
  loadOrders({ page: pagination.page });
});

// Pagination change
const changePage = (page) => {
  loadOrders({
    salesperson: filterState.value.salesperson,
    status: filterState.value.status,
    search: filterState.value.search,
    startTime: filterDateRange.value.start,
    endTime: filterDateRange.value.end,
    page,
  });
};

// Status Change Handler (Local wrapper)
const handleStatusChange = async (order, { status, note }) => {
  statusChanging[order.id] = true;
  try {
    const success = await changeStatus(order.id, status, note);
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
</script>
