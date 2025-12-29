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
        <div class="relative">
          <input 
            v-model="searchQuery"
            type="text"
            :placeholder="t('common.searchPlaceholder')"
            class="pl-9 pr-4 h-9 w-full sm:w-48 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none"
            @input="handleSearch"
          >
          <svg class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>
    </div>

    <!-- 订单列表 -->
    <div class="flex-1 overflow-auto">
      <!-- 桌面表格视图 (lg+) -->
      <table class="hidden lg:table w-full text-sm text-left relative">
        <thead class="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
          <tr>
            <th class="px-4 py-3">{{ t('order.form.productName') }}</th>
            <th class="px-4 py-3">{{ t('salesperson.name') }}</th>
            <th class="px-4 py-3">{{ t('order.orderNo') }}</th>
            <th class="px-4 py-3">{{ t('order.status') }}</th>
            <th class="px-4 py-3">{{ t('order.createdAt') }}</th>
            <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-if="loading" v-for="i in 5" :key="i" class="animate-pulse">
            <td v-for="j in 6" :key="j" class="px-4 py-4">
              <div class="h-4 bg-gray-200 rounded w-2/3"></div>
            </td>
          </tr>
          
          <template v-else-if="orders.length > 0">
            <tr 
              v-for="order in orders" 
              :key="order.id" 
              class="hover:bg-gray-50 transition-colors group cursor-pointer"
              @click="openDetailModal(order)"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <!-- 缩略图 -->
                  <div class="w-10 h-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                     <img v-if="order.mainImage" :src="order.mainImage" class="w-full h-full object-cover">
                     <div v-else class="w-full h-full flex items-center justify-center">
                       <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                       </svg>
                     </div>
                  </div>
                  <div>
                    <div class="font-medium text-gray-900 flex items-center gap-2">
                      {{ order.productName || '-' }}
                      <!-- 红点 -->
                      <span v-if="order.hasNewFeedback" class="w-2 h-2 bg-red-500 rounded-full animate-pulse" :title="t('order.portal.hasUpdate')"></span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <div class="text-gray-900">{{ order.salesperson?.name }}</div>
                <div class="text-xs text-gray-500">{{ order.salesperson?.store }}</div>
              </td>
              <td class="px-4 py-3 text-gray-500 font-mono text-xs">{{ order.orderNo }}</td>
              <td class="px-4 py-3">
                <OrderStatusChanger 
                  :status="order.status"
                  :loading="statusChanging[order.id]"
                  @change="(e) => handleStatusChange(order, e)"
                />
              </td>
              <td class="px-4 py-3 text-gray-500 text-xs">{{ formatTime(order.createdAt) }}</td>
              <td class="px-4 py-3 text-right" @click.stop>
                <button 
                  @click="openEditModal(order)"
                  class="text-primary hover:text-gray-900 font-medium text-xs border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {{ t('order.manage.editOrder') }}
                </button>
              </td>
            </tr>
          </template>

          <tr v-else>
            <td colspan="6" class="px-4 py-16 text-center text-gray-500">
              <div class="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <p>{{ t('order.portal.emptyOrders') }}</p>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 移动端卡片视图 (<lg) -->
      <div class="lg:hidden p-4 space-y-3">
        <!-- 加载状态 -->
        <div v-if="loading" v-for="i in 5" :key="i" class="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div class="flex gap-3">
            <div class="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-200 rounded w-3/4"></div>
              <div class="h-3 bg-gray-200 rounded w-1/2"></div>
              <div class="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </div>

        <!-- 订单卡片 -->
        <template v-else-if="orders.length > 0">
          <div 
            v-for="order in orders" 
            :key="order.id"
            class="bg-white rounded-xl border border-gray-200 overflow-hidden active:bg-gray-50 transition-colors"
            @click="openDetailModal(order)"
          >
            <div class="p-4 flex gap-3">
              <!-- 主图 -->
              <div class="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                <img v-if="order.mainImage" :src="order.mainImage" class="w-full h-full object-cover">
                <div v-else class="w-full h-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
              </div>
              
              <!-- 信息 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div class="font-medium text-gray-900 truncate flex items-center gap-2">
                    {{ order.productName || '-' }}
                    <span v-if="order.hasNewFeedback" class="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></span>
                  </div>
                  <OrderStatusChanger 
                    :status="order.status"
                    :loading="statusChanging[order.id]"
                    @change="(e) => handleStatusChange(order, e)"
                    @click.stop
                  />
                </div>
                <div class="text-xs text-gray-500 mt-1">{{ order.salesperson?.name }} · {{ order.salesperson?.store }}</div>
                <div class="text-xs text-gray-400 mt-1 font-mono">{{ order.orderNo }}</div>
              </div>
            </div>
            
            <!-- 底部操作栏 -->
            <div class="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-gray-50/50" @click.stop>
              <span class="text-xs text-gray-400">{{ formatTime(order.createdAt) }}</span>
              <button 
                @click="openEditModal(order)"
                class="text-primary font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {{ t('order.manage.editOrder') }}
              </button>
            </div>
          </div>
        </template>

        <!-- 空状态 -->
        <div v-else class="py-16 text-center text-gray-500">
          <div class="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <p>{{ t('order.portal.emptyOrders') }}</p>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.totalPages > 1" class="p-4 border-t border-gray-200 flex justify-center flex-shrink-0">
      <nav class="flex gap-1">
        <button 
          v-for="page in pagination.totalPages" 
          :key="page"
          @click="changePage(page)"
          class="px-3 py-1 text-sm rounded-md transition-colors"
          :class="page === pagination.page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'"
        >
          {{ page }}
        </button>
      </nav>
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
    <div v-if="showDetailModal && viewingOrder" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" @click.self="closeDetailModal">
      <div class="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-4 overflow-y-auto">
          <OrderDetail 
            :order="viewingOrder" 
            mode="admin"
            @back="closeDetailModal"
            @comment="handleAdminComment"
            @refresh="refreshAfterComment"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useOrders } from '@/composables/useOrders';
import { useI18n } from '@/composables/useI18n';
import OrderStatusChanger from './OrderStatusChanger.vue';
import OrderEditModal from './OrderEditModal.vue';
import OrderDetail from './order/OrderDetail.vue';

const { orders, salespersons, statuses, loading, pagination, loadOrders, getOrder, updateOrder, changeStatus } = useOrders();
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

// 搜索 (防抖)
let searchTimeout;
const handleSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(handleFilterChange, 300);
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
        // 如果是在筛选状态下，变更后该订单会消失，所以重新加载列表
        handleFilterChange();
      } else {
        // 否则直接更新本地状态
        order.status = status;
      }
    }
  } finally {
    statusChanging[order.id] = false;
  }
};

// 打开编辑弹窗
const openEditModal = async (order) => {
  // 获取完整详情（包含 originalData）
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
      loadOrders({ page: pagination.value.page }); // 刷新列表
    }
  } finally {
    isEditing.value = false;
  }
};

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 管理端留言
const handleAdminComment = async (comment) => {
  if (!viewingOrder.value || !comment.trim()) return;

  try {
    const res = await fetch(`/api/manage/orders/${viewingOrder.value.id}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
      credentials: 'include'
    });
    const result = await res.json();
    if (result.success) {
      // 刷新详情
      refreshAfterComment();
    }
  } catch (e) {
    console.error('Admin comment error', e);
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
