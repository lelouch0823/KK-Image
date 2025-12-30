<template>
  <div class="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200">
    <!-- 头部操作栏 -->
    <div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">{{ t('order.manage.title') }}</h2>
        <p class="text-sm text-gray-500 mt-1">{{ t('order.manage.subtitle') }}</p>
      </div>

      <div class="flex items-center gap-3">
        <!-- 销售筛选 -->
        <select 
          v-model="filterSalesperson"
          @change="handleFilterChange"
          class="h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-primary focus:border-primary outline-none"
        >
          <option value="">{{ t('order.manage.allSalespersons') }}</option>
          <option v-for="s in salespersons" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>

        <!-- 状态筛选 -->
        <select 
          v-model="filterStatus"
          @change="handleFilterChange"
          class="h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-primary focus:border-primary outline-none"
        >
          <option value="">{{ t('order.manage.allStatuses') }}</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ t(`order.statuses.${s}`) }}</option>
        </select>

        <!-- 搜索 -->
        <SearchInput 
          v-model="searchQuery"
          :placeholder="t('common.searchPlaceholder')"
          @search="handleSearch"
          class="w-full sm:w-48"
        />
      </div>
    </div>

    <!-- 订单列表 -->
    <div class="flex-1 overflow-auto">
      <!-- 桌面表格视图 (lg+) -->
      <div class="hidden lg:block">
        <OrderTable 
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
        </OrderTable>
      </div>

      <!-- 移动端卡片视图 (<lg) -->
      <div class="lg:hidden p-4">
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

    <!-- 分页 -->
    <div v-if="pagination.totalPages > 1" class="p-4 border-t border-gray-200 flex-shrink-0">
      <Pagination 
        v-model:currentPage="pagination.page"
        :totalPages="pagination.totalPages"
        @change="changePage"
      />
    </div>

    <!-- 订单编辑弹窗 -->
    <OrderEditModal 
      v-if="showEditModal && editingOrder"
      :order="editingOrder"
      :submitting="isEditing"
      @close="closeEditModal"
      @submit="handleEditSubmit"
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
      />
    </Modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useOrders } from '@/composables/useOrders';
import { useI18n } from '@/composables/useI18n';
import SearchInput from '@/components/ui/SearchInput.vue';
import Pagination from '@/components/ui/Pagination.vue';
import Modal from '@/components/ui/Modal.vue';
import OrderTable from './order/OrderTable.vue';
import OrderCards from './order/OrderCards.vue';
import OrderStatusChanger from './OrderStatusChanger.vue';
import OrderEditModal from './OrderEditModal.vue';
import OrderDetail from './order/OrderDetail.vue';

const { orders, salespersons, statuses, loading, pagination, loadOrders, getOrder, updateOrder, changeStatus, addComment } = useOrders();
const { t } = useI18n();

const filterSalesperson = ref('');
const filterStatus = ref('');
const searchQuery = ref('');
const statusChanging = reactive({});
const showEditModal = ref(false);
const editingOrder = ref(null);
const viewingOrder = ref(null);
const isEditing = ref(false);
const showDetailModal = ref(false);

// 初始化
onMounted(() => {
  loadOrders();
});

// 筛选
const handleFilterChange = () => {
  loadOrders({
    salesperson: filterSalesperson.value,
    status: filterStatus.value,
    search: searchQuery.value,
    page: 1
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
    page
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

// 打开编辑弹窗
const openEditModal = async (order) => {
  const fullOrder = await getOrder(order.id);
  if (fullOrder) {
    editingOrder.value = fullOrder;
    showEditModal.value = true;
  }
};

// 关闭编辑弹窗
const closeEditModal = () => {
  showEditModal.value = false;
  editingOrder.value = null;
};

// 打开详情弹窗
const openDetailModal = async (order) => {
  const fullOrder = await getOrder(order.id);
  if (fullOrder) {
    viewingOrder.value = fullOrder;
    showDetailModal.value = true;
  }
};

// 关闭详情弹窗
const closeDetailModal = () => {
  showDetailModal.value = false;
  viewingOrder.value = null;
};

// 提交编辑
const handleEditSubmit = async ({ updates, reason }) => {
  if (isEditing.value) return;
  isEditing.value = true;
  try {
    const success = await updateOrder(editingOrder.value.id, updates, reason);
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
</script>
