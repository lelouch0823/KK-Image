<template>
  <div
    class="flex h-full flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm"
  >
    <!-- 头部操作栏 -->
    <div
      class="flex flex-shrink-0 flex-col justify-between gap-4 border-b border-[var(--border-color)] p-4 sm:flex-row sm:items-center"
    >
      <div>
        <h2 class="text-lg font-semibold text-[var(--text-main)]">{{ t('order.manage.title') }}</h2>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">{{ t('order.manage.subtitle') }}</p>
      </div>

      <div class="flex items-center gap-3">
        <!-- 销售筛选 -->
        <select
          v-model="filterSalesperson"
          class="h-9 rounded-lg border-[var(--border-color)] bg-[var(--bg-muted)] px-3 text-sm text-[var(--text-main)] transition-all outline-none focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          @change="handleFilterChange"
        >
          <option value="">{{ t('order.manage.allSalespersons') }}</option>
          <option v-for="s in salespersons" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>

        <!-- 状态筛选 -->
        <select
          v-model="filterStatus"
          class="h-9 rounded-lg border-[var(--border-color)] bg-[var(--bg-muted)] px-3 text-sm text-[var(--text-main)] transition-all outline-none focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          @change="handleFilterChange"
        >
          <option value="">{{ t('order.manage.allStatuses') }}</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ t(`order.statuses.${s}`) }}</option>
        </select>

        <!-- 搜索 -->
        <SearchInput
          v-model="searchQuery"
          :placeholder="t('common.searchPlaceholder')"
          class="w-full sm:w-48"
          @search="handleSearch"
        />

        <!-- 导出按钮 -->
        <button
          :disabled="exporting"
          class="flex h-9 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow-[var(--color-primary)]/10 shadow-sm transition-all hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:opacity-50"
          @click="exportOrders"
        >
          <svg v-if="exporting" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
          <svg v-else class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {{ exporting ? t('order.manage.exporting') : t('order.manage.export') }}
        </button>
      </div>
    </div>

    <!-- 订单统计仪表盘 -->
    <div class="px-4 pt-4">
      <OrderDashboard @filter="handleDashboardFilter" />
    </div>

    <!-- 订单列表 -->
    <div class="flex-1 overflow-auto">
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
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-4 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-4 opacity-0"
    >
      <div
        v-if="selectedIds.length > 0"
        class="sticky right-0 bottom-0 left-0 z-20 flex items-center justify-between gap-4 border-t border-[var(--border-color)] bg-[var(--bg-card)] bg-[var(--bg-card)]/90 px-4 py-3.5 shadow-xl shadow-black/10 backdrop-blur-md"
      >
        <div class="flex items-center gap-3">
          <span class="text-primary text-sm font-medium">
            {{ t('order.manage.selectedCount', { count: selectedIds.length }) }}
          </span>
          <button
            class="text-secondary text-sm transition-colors hover:text-primary"
            @click="selectedIds = []"
          >
            {{ t('order.manage.cancelSelect') }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button
            :disabled="batchProcessing"
            class="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white shadow-[var(--color-primary)]/10 shadow-lg transition-all hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:opacity-50"
            @click="handleBatchAction('confirm')"
          >
            <svg class="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {{ t('order.manage.batchConfirm') }}
          </button>
          <button
            :disabled="batchProcessing"
            class="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-warning)] px-4 text-sm font-bold text-white shadow-[var(--color-warning)]/10 shadow-lg transition-all hover:bg-[var(--color-warning)]/90 active:scale-95 disabled:opacity-50"
            @click="handleBatchAction('reject')"
          >
            <svg class="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {{ t('order.manage.batchReject') }}
          </button>
          <button
            :disabled="batchProcessing"
            class="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-danger)] px-4 text-sm font-bold text-white shadow-[var(--color-danger)]/10 shadow-lg transition-all hover:bg-[var(--color-danger)]/90 active:scale-95 disabled:opacity-50"
            @click="handleBatchAction('void')"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {{ t('order.manage.batchVoid') }}
          </button>
        </div>
      </div>
    </Transition>

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

    <!-- 订单编辑弹窗（z-index 根据打开顺序自动计算）-->
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
import { ref, reactive, onMounted, onActivated, nextTick } from 'vue';
import { useOrders } from '@/composables/useOrders';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';
import SearchInput from '@/components/ui/SearchInput.vue';
import Pagination from '@/components/ui/Pagination.vue';
import Modal from '@/components/ui/Modal.vue';
import OrderTable from './order/OrderTable.vue';
import OrderCards from './order/OrderCards.vue';
import OrderStatusChanger from './OrderStatusChanger.vue';
import OrderEditModal from './OrderEditModal.vue';
import OrderDetail from './order/OrderDetail.vue';
import OrderDashboard from './order/OrderDashboard.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

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

const filterSalesperson = ref('');
const filterStatus = ref('');
const filterDateRange = ref({ start: 0, end: 0 }); // Timestamp range
const searchQuery = ref('');
const statusChanging = reactive({});
const showEditModal = ref(false);
const editingOrder = ref(null);
const viewingOrder = ref(null);
const isEditing = ref(false);
const showDetailModal = ref(false);
const exporting = ref(false);
const selectedIds = ref([]);
const batchProcessing = ref(false);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

// 初始化
onMounted(() => {
  loadOrders();
});

// 每次进入页面刷新
onActivated(() => {
  loadOrders({ page: pagination.value.page });
});

// 筛选
const handleFilterChange = () => {
  loadOrders({
    salesperson: filterSalesperson.value,
    status: filterStatus.value,
    search: searchQuery.value,
    startTime: filterDateRange.value.start,
    endTime: filterDateRange.value.end,
    page: 1,
  });
};

// 搜索
const handleSearch = () => {
  handleFilterChange();
};

// 分页
const changePage = (page) => {
  loadOrders({
    salesperson: filterSalesperson.value,
    status: filterStatus.value,
    search: searchQuery.value,
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
      if (filterStatus.value && filterStatus.value !== status) {
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
    // SOTA Timezone: Beijing Time (UTC+8)
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const offset = 8 * 60 * 60 * 1000;

    // Beijing 'Today' Start (00:00:00)
    const beijingNow = new Date(utc + offset);
    beijingNow.setHours(0, 0, 0, 0);
    const start = beijingNow.getTime() - offset; // Convert back to UTC timestamp

    // Beijing 'Today' End (23:59:59)
    beijingNow.setHours(23, 59, 59, 999);
    const end = beijingNow.getTime() - offset;

    filterDateRange.value = { start, end };
    filterStatus.value = ''; // Clear status filter to show all today's orders
  } else if (type === 'pending') {
    filterStatus.value = 'pending';
    filterDateRange.value = { start: 0, end: 0 }; // Clear date filter
  }

  // Reload
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

// 关闭编辑弹窗（堆叠模式：刷新详情数据）
const closeEditModal = async () => {
  showEditModal.value = false;
  editingOrder.value = null;

  // 若详情仍在显示，刷新其数据
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

    // Clear red dot locally (SOTA: immediate feedback)
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
// 提交编辑
const handleEditSubmit = async ({ updates, reason, fileIds }) => {
  if (isEditing.value) return;
  isEditing.value = true;
  try {
    // 传入 fileIds (如果有)
    const success = await updateOrder(editingOrder.value.id, updates, reason, fileIds);
    if (success) {
      closeEditModal();
      loadOrders({ page: pagination.value.page });
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

// 从详情页打开编辑（堆叠模式：详情保持打开）
const handleEditFromDetail = (order) => {
  // 详情 Modal 保持打开，直接弹出编辑
  editingOrder.value = order;
  showEditModal.value = true;
};

// 导出订单
const exportOrders = async () => {
  if (exporting.value) return;
  exporting.value = true;

  try {
    // 构建查询参数
    const params = new URLSearchParams();
    if (filterSalesperson.value) params.set('salesperson', filterSalesperson.value);
    if (filterStatus.value) params.set('status', filterStatus.value);
    if (searchQuery.value) params.set('search', searchQuery.value);

    const url = `${API.MANAGE_ORDER_EXPORT}?${params.toString()}`;
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    // 获取 blob 并触发下载
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    // 从 Content-Disposition 获取文件名
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
          await loadOrders({ page: pagination.value.page });
          confirmData.value.show = false;
        }
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};
</script>
