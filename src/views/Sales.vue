<template>
  <div class="min-h-screen bg-[var(--bg-page)] font-sans text-[var(--text-main)] antialiased">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex min-h-screen items-center justify-center bg-[var(--bg-page)]">
      <div class="text-center">
        <div
          class="border-t-primary mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-[var(--border-color)]"
        ></div>
        <p class="text-secondary">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- 登录页面 -->
    <OrderLogin v-else-if="!isAuthenticated" :error="loginError" :on-submit="handleLogin" />

    <!-- 主应用 -->
    <template v-else>
      <!-- 顶部导航 -->
      <header
        class="sticky top-0 z-40 border-b border-[var(--border-color)] bg-[var(--bg-card)]/80 backdrop-blur-lg"
      >
        <div class="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:px-6">
          <div class="flex items-center gap-3">
            <div
              class="from-primary flex size-8 items-center justify-center rounded-lg bg-gradient-to-br to-[var(--color-gray-700)]"
            >
              <svg class="size-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                ></path>
              </svg>
            </div>
            <div>
              <h1 class="text-primary text-sm font-semibold">{{ t('order.portal.myOrders') }}</h1>
              <p class="text-secondary text-xs">{{ salesperson?.name }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- 通知铃铛 -->
            <div ref="notificationRef" class="relative">
              <button
                class="relative flex size-9 items-center justify-center rounded-lg border border-[var(--border-color)] transition-colors hover:bg-[var(--bg-hover)]"
                :class="{ 'bg-[var(--bg-hover)]': showNotifications }"
                :title="t('notification.title')"
                @click="toggleNotifications"
              >
                <svg class="text-secondary size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <!-- 红点 -->
                <span
                  v-if="notificationUnreadCount > 0"
                  class="absolute top-1.5 right-1.5 size-2 rounded-full border border-[var(--bg-card)] bg-[var(--color-danger)]"
                ></span>
              </button>

              <!-- 下拉弹窗 -->
              <Transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
              >
                <div
                  v-if="showNotifications"
                  class="absolute top-full right-0 z-50 mt-2 origin-top-right shadow-2xl"
                >
                  <SalesNotificationList
                    :close="() => (showNotifications = false)"
                    :on-navigate="handleNotificationNavigate"
                  />
                </div>
              </Transition>
            </div>

            <button
              v-if="currentView !== 'stats'"
              class="text-secondary hidden items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)] sm:flex"
              :title="t('salesStats.title')"
              @click="currentView = 'stats'"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                ></path>
              </svg>
              {{ t('salesStats.title') }}
            </button>
            <button
              v-if="currentView === 'list'"
              class="bg-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
              @click="handleNewOrder"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                ></path>
              </svg>
              {{ t('order.portal.newOrder') }}
            </button>
            <button
              v-else-if="currentView === 'form' || currentView === 'stats'"
              class="text-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
              @click="currentView = 'list'"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                ></path>
              </svg>
              {{ t('order.portal.myOrders') }}
            </button>
          </div>
        </div>
      </header>

      <!-- 内容区域 -->
      <main class="mx-auto max-w-screen-xl px-4 py-6 sm:px-6">
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
          :prefill="prefillData"
          :submit-progress="submitProgress"
          @submit="handleSubmitOrder"
          @cancel="handleCancelForm"
        />

        <!-- 订单详情 -->
        <OrderDetail
          v-else-if="currentView === 'detail' && selectedOrder"
          :order="selectedOrder"
          mode="sales"
          @back="handleBackToList"
          @comment="handleComment"
          @refresh="handleRefreshOrder"
          @duplicate="handleDuplicate"
        />

        <!-- 个人统计 -->
        <SalesStats v-else-if="currentView === 'stats'" :token="accessToken" />
      </main>

      <!-- 底部安全区域 -->
      <div class="h-[env(safe-area-inset-bottom)]"></div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePushNotification } from '@/composables/usePushNotification';
import { useToast } from '@/composables/useToast';
import { useOrders } from '@/composables/useOrders';
import { useNotifications } from '@/composables/useNotifications';
import OrderLogin from '@/components/order/OrderLogin.vue';
import OrderList from '@/components/order/OrderList.vue';
import OrderForm from '@/components/order/OrderForm.vue';
import OrderDetail from '@/components/order/OrderDetail.vue';
import SalesStats from '@/components/order/SalesStats.vue';
import SalesNotificationList from '@/components/order/SalesNotificationList.vue';
import { onClickOutside } from '@vueuse/core';

const {
  loading: ordersLoading,
  orders,
  checkSalesAuth,
  loginSales,
  loadSalesOrders,
  getSalesOrder,
  createSalesOrder,
  addSalesComment,
} = useOrders();

const { t } = useI18n();
const { requestPermission, showOrderFeedbackNotification } = usePushNotification();
const { addToast } = useToast();
const {
  unreadCount: notificationUnreadCount,
  setSalesMode,
  startPolling: startNotificationPolling,
  stopPolling: stopNotificationPolling,
} = useNotifications();

const route = useRoute();
const accessToken = computed(() => route.params.token);

// 状态
const loading = ref(true);
const isAuthenticated = ref(false);
const loginError = ref('');
const salesperson = ref(null);
const currentView = ref('list'); // list | form | detail
const selectedOrder = ref(null);
const prefillData = ref(null); // 预填充数据 (复制订单用)
const pollIntervalId = ref(null);
const submitProgress = ref({ step: '', current: 0, total: 0 }); // 提交进度

// 通知相关状态
const showNotifications = ref(false);
const notificationRef = ref(null);

// 点击外部关闭通知弹窗
onClickOutside(notificationRef, () => {
  showNotifications.value = false;
});

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
};

// 通知导航处理
const handleNotificationNavigate = async (orderId) => {
  // 查找订单并跳转到详情
  const order = orders.value.find((o) => o.id === orderId);
  if (order) {
    await viewOrder(order);
  } else {
    // 如果列表中没有，直接请求详情
    const data = await getSalesOrder(accessToken.value, orderId);
    if (data) {
      selectedOrder.value = data;
      currentView.value = 'detail';
    }
  }
};

// 轮询间隔 (60秒)
const POLL_INTERVAL = 60 * 1000;

// 检查登录状态
const checkAuth = async () => {
  if (!accessToken.value) {
    loading.value = false;
    return;
  }

  const data = await checkSalesAuth(accessToken.value);
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
  const result = await loginSales(accessToken.value, password);
  if (result.success) {
    isAuthenticated.value = true;
    salesperson.value = result.data;
    await loadOrders();
  } else {
    loginError.value = result.message;
  }
};

// 加载订单列表
const loadOrders = () => loadSalesOrders(accessToken.value);

// 查看订单详情
const viewOrder = async (order) => {
  const data = await getSalesOrder(accessToken.value, order.id);
  if (data) {
    selectedOrder.value = data;
    currentView.value = 'detail';

    // 如果列表里有红点，清除它（本地更新，避免重新加载列表）
    if (data.hasNewFeedback) {
      const idx = orders.value.findIndex((o) => o.id === order.id);
      if (idx !== -1) {
        orders.value[idx].hasNewFeedback = false;
      }
    }
  }
};

// 提交订单
const handleSubmitOrder = async (formData) => {
  const handleProgress = (step, current, total) => {
    submitProgress.value = { step, current, total };
  };

  const result = await createSalesOrder(accessToken.value, formData, handleProgress);

  // 重置进度
  submitProgress.value = { step: '', current: 0, total: 0 };

  if (result) {
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
  const success = await addSalesComment(accessToken.value, selectedOrder.value.id, comment);
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

// 复制订单 (预填充表单)
const handleDuplicate = (order) => {
  // 直接使用订单数据填充表单，无需重新请求 API
  const currentData = order.currentData || {};

  // 复制已有的图片 (转换为预填充格式)
  const prefillFiles = (order.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    url: f.url,
    mimeType: f.mimeType,
    size: f.size,
    isLocal: false, // 标记为服务端已有文件
  }));

  prefillData.value = {
    name: currentData.name || '',
    brand: currentData.brand || '',
    series: currentData.series || '',
    size: currentData.size || '',
    color: currentData.color || '',
    material: currentData.material || '',
    remark: currentData.remark || '',
    deadline: currentData.deadline || '', // 复制期望到货时间
    files: prefillFiles, // 复制图片列表
  };

  currentView.value = 'form';
  addToast({ message: t('order.actions.duplicateSuccess'), type: 'success' });
};

// 新建订单 (清除预填充)
const handleNewOrder = () => {
  prefillData.value = null;
  currentView.value = 'form';
};

// 监听视图切换，自动刷新列表
watch(currentView, (newVal) => {
  if (newVal === 'list' && isAuthenticated.value) {
    loadOrders();
  }
});

// 取消表单 (清除预填充)
const handleCancelForm = () => {
  prefillData.value = null;
  currentView.value = 'list';
};

// 轮询检查新消息
const checkNewFeedback = async () => {
  if (!isAuthenticated.value || !accessToken.value) return;

  // 记录当前有反馈的订单ID
  const prevFeedbackIds = new Set(orders.value.filter((o) => o.hasNewFeedback).map((o) => o.id));

  // 静默刷新订单列表
  await loadSalesOrders(accessToken.value);

  // 检测新增的反馈
  orders.value.forEach((order) => {
    if (order.hasNewFeedback && !prevFeedbackIds.has(order.id)) {
      showOrderFeedbackNotification(order, () => {
        viewOrder(order);
      });
    }
  });
};

// 启动轮询
const startPolling = () => {
  if (pollIntervalId.value) return;
  pollIntervalId.value = setInterval(checkNewFeedback, POLL_INTERVAL);
};

// 停止轮询
const stopPolling = () => {
  if (pollIntervalId.value) {
    clearInterval(pollIntervalId.value);
    pollIntervalId.value = null;
  }
};

// 监听 Token 变化 (处理 SPA 同组件跳转)
watch(accessToken, () => {
  loading.value = true;
  isAuthenticated.value = false;
  salesperson.value = null;
  checkAuth();
});

onMounted(async () => {
  await checkAuth();
  // 登录成功后请求通知权限并启动轮询
  if (isAuthenticated.value) {
    requestPermission();
    startPolling();
    // 初始化销售端通知模式并启动轮询
    setSalesMode(accessToken.value);
    startNotificationPolling();
  }
});

onUnmounted(() => {
  stopPolling();
  stopNotificationPolling();
});
</script>
