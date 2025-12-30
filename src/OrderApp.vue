<template>
  <div class="min-h-screen font-sans antialiased text-[var(--text-main)] bg-[var(--bg-page)]">
    
    <!-- 加载状态 -->
    <div v-if="loading" class="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
      <div class="text-center">
        <div class="w-12 h-12 border-4 border-[var(--border-color)] border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-secondary">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- 登录页面 -->
    <OrderLogin 
      v-else-if="!isAuthenticated" 
      :error="loginError"
      :onSubmit="handleLogin"
    />

    <!-- 主应用 -->
    <template v-else>
      <!-- 顶部导航 -->
      <header class="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-[var(--border-color)]">
        <div class="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-gradient-to-br from-primary to-[var(--color-gray-700)] rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
            <div>
              <h1 class="text-sm font-semibold text-primary">{{ t('order.portal.myOrders') }}</h1>
              <p class="text-xs text-secondary">{{ salesperson?.name }}</p>
            </div>
          </div>
          <button 
            @click="currentView = 'form'" 
            v-if="currentView === 'list'"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            {{ t('order.portal.newOrder') }}
          </button>
          <button 
            @click="currentView = 'list'" 
            v-else-if="currentView === 'form'"
            class="flex items-center gap-1.5 px-3 py-1.5 text-secondary text-sm font-medium rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            {{ t('order.portal.myOrders') }}
          </button>
        </div>
      </header>

      <!-- 内容区域 -->
      <main class="max-w-lg mx-auto px-4 py-6">
        <!-- 订单列表 -->
        <OrderList 
          v-if="currentView === 'list'" 
          :orders="orders"
          :loading="ordersLoading"
          @refresh="loadOrders"
          @view="viewOrder"
        />

        <!-- 新建订单表单 -->
        <OrderForm 
          v-else-if="currentView === 'form'"
          @submit="handleSubmitOrder"
          @cancel="currentView = 'list'"
        />

        <!-- 订单详情 -->
        <OrderDetail 
          v-else-if="currentView === 'detail' && selectedOrder"
          :order="selectedOrder"
          mode="sales"
          @back="handleBackToList"
          @comment="handleComment"
          @refresh="handleRefreshOrder"
        />
      </main>

      <!-- 底部安全区域 -->
      <div class="h-[env(safe-area-inset-bottom)]"></div>
    </template>

    <!-- Toast -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useOrders } from '@/composables/useOrders';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import OrderLogin from '@/components/order/OrderLogin.vue';
import OrderList from '@/components/order/OrderList.vue';
import OrderForm from '@/components/order/OrderForm.vue';
import OrderDetail from '@/components/order/OrderDetail.vue';

const {
  loading: ordersLoading,
  orders,
  checkSalesAuth,
  loginSales,
  loadSalesOrders,
  getSalesOrder,
  createSalesOrder,
  addSalesComment
} = useOrders();

const { t } = useI18n();

// 状态
const loading = ref(true);
const isAuthenticated = ref(false);
const loginError = ref('');
const salesperson = ref(null);
const currentView = ref('list'); // list | form | detail
const selectedOrder = ref(null);

// 从 URL 获取访问令牌
const getAccessToken = () => {
  const path = window.location.pathname;
  const match = path.match(/\/sales\/([^\/]+)/);
  return match ? match[1] : null;
};

const accessToken = getAccessToken();

// 检查登录状态
const checkAuth = async () => {
  if (!accessToken) {
    loading.value = false;
    return;
  }

  const data = await checkSalesAuth(accessToken);
  if (data) {
    isAuthenticated.value = true;
    salesperson.value = data;
    await loadOrders();
  }
  loading.value = false;
};

// 登录
const handleLogin = async (password) => {
  loginError.value = '';
  const result = await loginSales(accessToken, password);
  if (result.success) {
    isAuthenticated.value = true;
    salesperson.value = result.data;
    await loadOrders();
  } else {
    loginError.value = result.message;
  }
};

// 加载订单列表
const loadOrders = () => loadSalesOrders(accessToken);

// 查看订单详情
const viewOrder = async (order) => {
  const data = await getSalesOrder(accessToken, order.id);
  if (data) {
    selectedOrder.value = data;
    currentView.value = 'detail';
    
    // 如果列表里有红点，清除它（本地更新，避免重新加载列表）
    if (data.hasNewFeedback) {
      const idx = orders.value.findIndex(o => o.id === order.id);
      if (idx !== -1) {
        orders.value[idx].hasNewFeedback = false;
      }
    }
  }
};

// 提交订单
const handleSubmitOrder = async (formData) => {
  const success = await createSalesOrder(accessToken, formData);
  if (success) {
    currentView.value = 'list';
    await loadOrders();
  }
};

// 返回列表
const handleBackToList = () => {
  currentView.value = 'list';
  selectedOrder.value = null;
};

// 添加留言
const handleComment = async (comment) => {
  if (!selectedOrder.value) return;
  const success = await addSalesComment(accessToken, selectedOrder.value.id, comment);
  if (success) {
    // 重新加载详情以显示新留言
    await viewOrder(selectedOrder.value);
  }
};

// 刷新当前订单详情
const handleRefreshOrder = async () => {
  if (!selectedOrder.value) return;
  await viewOrder(selectedOrder.value);
  loadOrders(); // 同时刷新列表
};

onMounted(checkAuth);
</script>
