<template>
  <div
    class="flex flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm lg:h-full"
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
    <div class="hidden px-4 pt-4 lg:block">
      <OrderDashboard @filter="handleDashboardFilter" />
    </div>

    <!-- Mobile Stats Modal -->
    <Modal v-model="showStatsModal" :title="t('dashboard.stats')">
      <OrderDashboard is-popup @filter="(type) => { handleDashboardFilter(type); showStatsModal = false; }" />
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
      @action="handleBatchAction"
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
    <Modal v-model="showDetailModal" size="6xl" :title="t('order.detail.title')">
      <OrderDetail
        v-if="viewingOrder"
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
      @submit="handleEditSubmit"
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
import { ref, reactive, onMounted, onActivated, watch } from 'vue';
import { useOrders } from '@/composables/useOrders';
import { useNotifications } from '@/composables/useNotifications';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';
import { DateUtils } from '@/utils/date';

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
import { useAuth } from '@/composables/useAuth';

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
const { addToast } = useToast();
const { authFetch } = useAuth(); // Import useAuth
// SOTA: Auto-refresh on notification
const { lastNotificationTime } = useNotifications();

// Watch for notifications to auto-refresh
watch(lastNotificationTime, () => {
  // Only refresh if not editing or viewing detail to avoid disruption
  if (!showEditModal.value && !showDetailModal.value && !showCreateModal.value) {
    loadOrders({ page: pagination.page });
  }
});

// Filter state (unified object for v-model)
const filterState = ref({
  salesperson: '',
  status: '',
  search: '',
});
const filterDateRange = ref({ start: 0, end: 0 });

const statusChanging = reactive({});
const showEditModal = ref(false);
const editingOrder = ref(null);
const viewingOrder = ref(null);
const isEditing = ref(false);
const showDetailModal = ref(false);
const showStatsModal = ref(false);
const showCreateModal = ref(false); // New state
const exporting = ref(false);
const selectedIds = ref([]);
const batchProcessing = ref(false);

// Create Order (Admin)
const handleCreateOrder = async (data) => {
  try {
    const res = await authFetch(API.MANAGE_ORDERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: data.name, // Mapping
        ...data,
      }),
    }).then((r) => r.json());

    if (res.success) {
      addToast({ message: t('order.manage.createSuccess') || '订单创建成功', type: 'success' });
      showCreateModal.value = false;
      loadOrders({ page: 1 });
    } else {
      addToast({ message: res.error || t('common.operationFailed'), type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  }
};

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

// Watch filter changes
watch(filterState, () => {
  handleFilterChange();
}, { deep: true });

// 初始化
onMounted(() => {
  loadOrders();
});

// 每次进入页面刷新
onActivated(() => {
  loadOrders({ page: pagination.page });
});

// 筛选
const handleFilterChange = () => {
  loadOrders({
    salesperson: filterState.value.salesperson,
    status: filterState.value.status,
    search: filterState.value.search,
    startTime: filterDateRange.value.start,
    endTime: filterDateRange.value.end,
    page: 1,
  });
};

// 分页
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

// 状态变更
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

// 仪表盘筛选
const handleDashboardFilter = (type) => {
  if (type === 'today') {
    const start = DateUtils.getBeijingDayStart();
    const end = DateUtils.getBeijingDayEnd();

    filterDateRange.value = { start, end };
    filterState.value.status = '';
  } else if (type === 'pending') {
    filterState.value.status = 'pending';
    filterDateRange.value = { start: 0, end: 0 };
  }

  handleFilterChange();
};

// 打开编辑弹窗
const openEditModal = async (order) => {
  const fullOrder = await getOrder(order.id);
  if (fullOrder) {
    editingOrder.value = fullOrder;
    showEditModal.value = true;
  }
};

// 关闭编辑弹窗
const closeEditModal = async () => {
  showEditModal.value = false;
  editingOrder.value = null;

  if (showDetailModal.value && viewingOrder.value) {
    const updated = await getOrder(viewingOrder.value.id);
    if (updated) viewingOrder.value = updated;
  }
};

// 打开详情弹窗
const openDetailModal = async (order) => {
  const fullOrder = await getOrder(order.id);
  if (fullOrder) {
    viewingOrder.value = fullOrder;
    showDetailModal.value = true;

    const idx = orders.value.findIndex((o) => o.id === order.id);
    if (idx !== -1 && orders.value[idx].hasNewFeedback) {
      orders.value[idx].hasNewFeedback = false;
    }
  }
};

// 关闭详情弹窗
const closeDetailModal = () => {
  showDetailModal.value = false;
  viewingOrder.value = null;
};

// 作废订单
const handleVoidOrder = (order) => {
  confirmData.value = {
    show: true,
    title: t('common.confirm'),
    message: t('order.actions.voidConfirm'),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        const success = await changeStatus(order.id, 'void');
        if (success) {
          order.status = 'void';
          addToast({ message: t('order.actions.voidSuccess'), type: 'success' });
          confirmData.value.show = false;
        }
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

// 提交编辑
const handleEditSubmit = async ({ updates, reason, fileIds }) => {
  if (isEditing.value) return;
  isEditing.value = true;
  try {
    const success = await updateOrder(editingOrder.value.id, updates, reason, fileIds);
    if (success) {
      closeEditModal();
      loadOrders({ page: pagination.page });
    }
  } finally {
    isEditing.value = false;
  }
};

// 管理端留言
const handleAdminComment = async (comment) => {
  if (!viewingOrder.value || !comment.trim()) return;
  const success = await addComment(viewingOrder.value.id, comment);
  if (success) {
    refreshAfterComment();
  }
};

// 刷新详情
const refreshAfterComment = async () => {
  if (!viewingOrder.value) return;
  const fullOrder = await getOrder(viewingOrder.value.id);
  if (fullOrder) {
    viewingOrder.value = fullOrder;
  }
};

// 从详情页打开编辑
const handleEditFromDetail = (order) => {
  editingOrder.value = order;
  showEditModal.value = true;
};

// 导出订单
const exportOrders = async () => {
  if (exporting.value) return;
  exporting.value = true;

  try {
    const params = new URLSearchParams();
    if (filterState.value.salesperson) params.set('salesperson', filterState.value.salesperson);
    if (filterState.value.status) params.set('status', filterState.value.status);
    if (filterState.value.search) params.set('search', filterState.value.search);

    const url = `${API.MANAGE_ORDER_EXPORT}?${params.toString()}`;
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const disposition = response.headers.get('Content-Disposition');
    const filenameMatch = disposition && disposition.match(/filename="?(.+)"?/);
    link.download = filenameMatch
      ? filenameMatch[1]
      : `orders_${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    addToast({ message: t('order.manage.exportSuccess'), type: 'success' });
  } catch (e) {
    console.error('Export error:', e);
    addToast({ message: t('order.manage.exportFailed'), type: 'error' });
  } finally {
    exporting.value = false;
  }
};

// 批量操作处理
const handleBatchAction = (action) => {
  if (batchProcessing.value || selectedIds.value.length === 0) return;

  const count = selectedIds.value.length;
  let title = '';
  let message = '';
  let type = 'primary';

  if (action === 'confirm') {
    title = t('order.manage.batchConfirm');
    message = t('order.manage.batchConfirmConfirm', { count });
    type = 'primary';
  } else if (action === 'reject') {
    title = t('order.manage.batchReject');
    message = t('order.manage.batchRejectConfirm', { count });
    type = 'warning';
  } else if (action === 'void') {
    title = t('order.manage.batchVoid');
    message = t('order.manage.batchVoidConfirm', { count });
    type = 'danger';
  }

  confirmData.value = {
    show: true,
    title,
    message,
    type,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        const result = await batchAction(selectedIds.value, action);
        if (result) {
          selectedIds.value = [];
          await loadOrders({ page: pagination.page });
          confirmData.value.show = false;
        }
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};
</script>
