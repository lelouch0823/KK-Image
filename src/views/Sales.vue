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

    <!-- 主应用 (已认证) -->
    <div v-else>
      <!-- 顶部导航 -->
      <header
        class="sticky top-0 z-40 border-b border-[var(--border-color)] bg-[var(--bg-card)]/90 backdrop-blur-lg transition-all"
      >
        <div class="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:px-6">
          <div class="flex items-center gap-3">
            <!-- List Page: Logo & User Info -->
            <template v-if="isListPage">
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
            </template>

            <template v-else>
              <AppButton
                variant="secondary"
                size="sm"
                class="group !p-0 !size-8"
                @click="router.push(`/sales/${accessToken}`)"
              >
                <template #icon-left>
                  <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </template>
              </AppButton>
              <h1 class="text-primary text-sm font-semibold">{{ pageTitle }}</h1>
            </template>
          </div>
          <div class="flex items-center gap-2">
            <!-- 通知铃铛 -->
            <div ref="notificationRef" class="relative">
              <AppButton
                variant="secondary"
                size="sm"
                class="relative !size-9 !p-0"
                :class="{ 'bg-(--bg-hover)': showNotifications }"
                :title="t('notification.title')"
                @click="toggleNotifications"
              >
                <template #icon-left>
                  <svg class="text-secondary size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </template>
                <template #default>
                  <!-- 红点 -->
                  <span
                    v-if="notificationUnreadCount > 0"
                    class="absolute top-1.5 right-1.5 size-2 rounded-full border border-(--bg-card) bg-danger"
                  ></span>
                </template>
              </AppButton>

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
                  class="fixed inset-x-4 top-16 z-50 origin-top shadow-2xl sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96 sm:origin-top-right"
                >
                  <SalesNotificationList
                    :close="() => (showNotifications = false)"
                    :on-navigate="handleNotificationNavigate"
                  />
                </div>
              </Transition>
            </div>

            <!-- Header Actions -->
            <AppButton
              v-if="!isStatsPage"
              variant="ghost"
              size="sm"
              class="hidden sm:flex"
              :text="t('salesStats.title')"
              @click="router.push(`/sales/${accessToken}/stats`)"
            >
              <template #icon-left>
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              </template>
            </AppButton>
            <div class="flex gap-2">
        <AppInput
          v-model="searchQuery"
          size="sm"
          :placeholder="t('common.search')"
          class="w-64"
        >
          <template #prepend>
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </template>
        </AppInput>
        <AppButton
          variant="primary"
          :text="t('sales.createOrder')"
          class="whitespace-nowrap"
          @click="openCreateModal"
        >
          <template #icon-left>
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          </template>
        </AppButton>
      </div>
          </div>
        </div>
      </header>

      <!-- Content Area using Router View -->
      <main class="mx-auto max-w-screen-xl px-4 py-6 sm:px-6">
          <router-view />
      </main>

      <!-- Safe Area -->
      <div class="h-[env(safe-area-inset-bottom)]"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePushNotification } from '@/composables/usePushNotification';
import { useOrders } from '@/composables/useOrders';
import { useNotifications } from '@/composables/useNotifications';
import OrderLogin from '@/components/order/OrderLogin.vue';
import SalesNotificationList from '@/components/order/SalesNotificationList.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import { onClickOutside } from '@vueuse/core';

const route = useRoute();
const router = useRouter();

const {
  loading: ordersLoading,
  orders,
  checkSalesAuth,
  loginSales,
  loadSalesOrders,
  pagination: ordersPagination,
} = useOrders();

const { t } = useI18n();
const { requestPermission, showOrderFeedbackNotification } = usePushNotification();
const {
  unreadCount: notificationUnreadCount,
  lastNotificationTime,
  setSalesMode,
  startPolling: startNotificationPolling,
  stopPolling: stopNotificationPolling,
} = useNotifications();

const accessToken = computed(() => route.params.token);

// Derived state for Header Actions
const isStatsPage = computed(() => route.path.endsWith('/stats'));
const isListPage = computed(() => route.path === `/sales/${accessToken.value}` || route.path === `/sales/${accessToken.value}/`);

const pageTitle = computed(() => {
  if (isListPage.value) return t('order.portal.myOrders');
  if (route.path.includes('/create')) return t('order.portal.newOrder');
  if (route.path.includes('/detail')) return t('order.detail.title');
  if (route.path.includes('/stats')) return t('salesStats.title');
  return '';
});

// Auth State
const loading = ref(true);
const isAuthenticated = ref(false);
const loginError = ref('');
const salesperson = ref(null);
const prefillData = ref(null); // Shared state for duplicating order

// Provide context to child views
provide('salesContext', {
    orders,
    loading: ordersLoading,
    salesperson, // In case needed
    loadOrders: (page, append) => loadSalesOrders(accessToken.value, page, append),
    pagination: ordersPagination,
    prefillData,
    setPrefillData: (data) => { prefillData.value = data }
});

// Notifications Logic
const showNotifications = ref(false);
const notificationRef = ref(null);
onClickOutside(notificationRef, () => showNotifications.value = false);
const toggleNotifications = () => showNotifications.value = !showNotifications.value;

const handleNotificationNavigate = async (orderId) => {
  showNotifications.value = false;
  router.push(`/sales/${accessToken.value}/detail/${orderId}`);
};

const openCreateModal = () => {
    router.push(`/sales/${accessToken.value}/create`);
};

// Auto-refresh logic (Centralized)
watch(lastNotificationTime, async () => {
  if (isAuthenticated.value && isListPage.value) {
    const prevFeedbackIds = new Set(orders.value.filter((o) => o.hasNewFeedback).map((o) => o.id));
    await loadSalesOrders(accessToken.value);
    
    // Check for NEW feedback
    orders.value.forEach((order) => {
      if (order.hasNewFeedback && !prevFeedbackIds.has(order.id)) {
        showOrderFeedbackNotification(order, () => {
           router.push(`/sales/${accessToken.value}/detail/${order.id}`);
        });
      }
    });
  }
});

// Auth & Init
const checkAuth = async () => {
  if (!accessToken.value) {
    loading.value = false;
    return;
  }
  const data = await checkSalesAuth(accessToken.value);
  if (data) {
    isAuthenticated.value = true;
    salesperson.value = data;
    await loadSalesOrders(accessToken.value);
  }
  loading.value = false;
};

const handleLogin = async (password) => {
  loginError.value = '';
  const result = await loginSales(accessToken.value, password);
  if (result.success) {
    isAuthenticated.value = true;
    salesperson.value = result.data;
    await loadSalesOrders(accessToken.value);
  } else {
    loginError.value = result.message;
  }
};

watch(accessToken, () => {
  loading.value = true;
  isAuthenticated.value = false;
  salesperson.value = null;
  checkAuth();
});

onMounted(async () => {
  await checkAuth();
  if (isAuthenticated.value) {
    requestPermission();
    setSalesMode(accessToken.value);
    startNotificationPolling();
  }
});

onUnmounted(() => {
  stopNotificationPolling();
});
</script>
