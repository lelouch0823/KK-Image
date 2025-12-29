<template>
  <div class="min-h-screen font-sans antialiased text-[var(--text-main)] bg-[var(--bg-page)]">
    
    <!-- 加载状态 -->
    <div v-if="loading" class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="w-12 h-12 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
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
            <div class="w-8 h-8 bg-gradient-to-br from-primary to-gray-700 rounded-lg flex items-center justify-center">
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
            class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            {{ t('order.portal.newOrder') }}
          </button>
          <button 
            @click="currentView = 'list'" 
            v-else-if="currentView === 'form'"
            class="flex items-center gap-1.5 px-3 py-1.5 text-secondary text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
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
import { ref, onMounted, computed } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import OrderLogin from '@/components/order/OrderLogin.vue';
import OrderList from '@/components/order/OrderList.vue';
import OrderForm from '@/components/order/OrderForm.vue';
import OrderDetail from '@/components/order/OrderDetail.vue';

const { addToast } = useToast();
const { t } = useI18n();

// 状态
const loading = ref(true);
const isAuthenticated = ref(false);
const loginError = ref('');
const salesperson = ref(null);
const orders = ref([]);
const ordersLoading = ref(false);
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

  try {
    const res = await fetch(API.SALES_AUTH(accessToken), {
      credentials: 'include'
    });
    const result = await res.json();

    if (result.success) {
      isAuthenticated.value = true;
      salesperson.value = result.data;
      await loadOrders();
    }
  } catch (e) {
    console.error('Auth check error:', e);
  } finally {
    loading.value = false;
  }
};

// 登录
const handleLogin = async (password, rememberMe) => {
  loginError.value = '';
  
  try {
    const res = await fetch(API.SALES_AUTH(accessToken), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password })
    });
    const result = await res.json();

    if (result.success) {
      isAuthenticated.value = true;
      salesperson.value = result.data;
      await loadOrders();
    } else {
      loginError.value = result.message || t('order.portal.passwordError');
    }
  } catch (e) {
    loginError.value = t('common.networkError');
  }
};

// 加载订单列表
const loadOrders = async () => {
  if (!accessToken) return;
  
  ordersLoading.value = true;
  try {
    const res = await fetch(API.SALES_ORDER_LIST(accessToken), {
      credentials: 'include'
    });
    const result = await res.json();

    if (result.success) {
      orders.value = result.data.orders;
    } else {
      addToast({ message: result.message || t('common.loadFailed'), type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    ordersLoading.value = false;
  }
};

// 查看订单详情
const viewOrder = async (order) => {
  try {
    const res = await fetch(API.SALES_ORDER_DETAIL(accessToken, order.id), {
      credentials: 'include'
    });
    const result = await res.json();

    if (result.success) {
      selectedOrder.value = result.data;
      currentView.value = 'detail';
      
      // 清除红点
      if (result.data.hasNewFeedback) {
        await fetch(API.SALES_ORDER_READ(accessToken, order.id), {
          method: 'PATCH',
          credentials: 'include'
        });
        // 更新列表中的状态
        const idx = orders.value.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          orders.value[idx].hasNewFeedback = false;
        }
      }
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  }
};

// 提交订单
const handleSubmitOrder = async (formData) => {
  try {
    const { files, ...orderData } = formData;
    
    // 先上传所有图片
    const fileIds = [];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const uploadFormData = new FormData();
          uploadFormData.append('file', file);
          
          const uploadRes = await fetch(API.SALES_UPLOAD(accessToken), {
            method: 'POST',
            body: uploadFormData,
            credentials: 'include'
          });
          const uploadResult = await uploadRes.json();
          
          if (uploadResult.success) {
            fileIds.push(uploadResult.data.id);
          } else {
            console.warn('Upload failed:', uploadResult.message);
          }
        } catch (e) {
          console.error('Upload error:', e);
        }
      }
    }
    
    // 创建订单
    const res = await fetch(API.SALES_ORDER_CREATE(accessToken), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...orderData, fileIds })
    });
    const result = await res.json();

    if (result.success) {
      addToast({ message: t('order.portal.submitSuccess'), type: 'success' });
      currentView.value = 'list';
      await loadOrders();
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
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

  try {
    const res = await fetch(API.SALES_ORDER_COMMENT(accessToken, selectedOrder.value.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ comment })
    });
    const result = await res.json();

    if (result.success) {
      addToast({ message: result.message, type: 'success' });
      // 重新加载详情
      await viewOrder(selectedOrder.value);
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
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
