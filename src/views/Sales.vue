<template>
  <div
    class="min-h-screen bg-(--bg-page) font-sans text-(--text-main) antialiased"
    :data-sales-order-mode="salesOrderEntry"
  >
    <!-- 加载状态 -->
    <div v-if="loading" class="flex min-h-screen items-center justify-center bg-(--bg-page)">
      <AsyncStatePanel state="loading" class="w-full max-w-md" />
    </div>

    <!-- 登录页面 -->
    <OrderLogin v-else-if="!isAuthenticated" :error="loginError" :on-submit="handleLogin" />

    <!-- 主应用 (已认证) -->
    <div v-else>
      <!-- 顶部导航 -->
      <header
        class="sticky top-0 z-40 border-b border-(--border-color) bg-(--bg-card)/90 backdrop-blur-lg transition-all"
      >
        <div class="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:px-6">
          <div class="flex items-center gap-3">
            <!-- List Page: Logo & User Info -->
            <template v-if="isListPage || isSpacesPage">
              <div
                class="from-primary flex size-8 items-center justify-center rounded-lg bg-gradient-to-br to-(--color-gray-700)"
              >
                <AppIcon name="clipboard-document-list" class="size-4 text-white" />
              </div>
              <div>
                <h1 class="text-primary text-sm font-semibold">{{ isSpacesPage ? t('salesSpaces.title') : t('order.portal.myOrders') }}</h1>
                <p class="text-xs text-(--text-secondary)">{{ salesperson?.name }}</p>
              </div>
            </template>

            <template v-else>
              <AppButton
                variant="secondary"
                size="sm"
                class="group !size-8 !p-0"
                @click="router.push(`/sales/${accessToken}`)"
              >
                <template #icon-left>
                  <AppIcon name="chevron-left" class="size-4" />
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
                  <AppIcon name="bell" class="text-secondary size-5" />
                </template>
                <template #default>
                  <!-- 红点 -->
                  <span
                    v-if="notificationUnreadCount > 0"
                    class="bg-danger absolute top-1.5 right-1.5 size-2 rounded-full border border-(--bg-card)"
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
            <!-- 统计按钮 - 移动端只显示图标 -->
            <AppButton
              v-if="!isStatsPage && !isSpacesPage"
              variant="ghost"
              size="sm"
              class="!size-9 !p-0 sm:!size-auto sm:!px-3 sm:!py-2"
              :title="t('salesStats.title')"
              @click="router.push(`/sales/${accessToken}/stats`)"
            >
              <template #icon-left>
                <AppIcon name="chart-bar" class="size-5 sm:size-4" />
              </template>
              <template #default>
                <span class="hidden sm:inline">{{ t('salesStats.title') }}</span>
              </template>
            </AppButton>
            <AppButton
              v-if="!isSpacesPage"
              variant="primary"
              :text="t('sales.createOrder')"
              class="whitespace-nowrap"
              @click="openCreateModal"
            >
              <template #icon-left>
                <AppIcon name="plus" class="size-4" />
              </template>
            </AppButton>
          </div>
        </div>
      </header>

      <!-- Content Area using Router View -->
      <AppErrorBoundary :reset-key="route.fullPath" @recover="handleBoundaryRecover">
        <MobileSalesShell :title="pageTitle" :description="salesDescription">
            <router-view />
        </MobileSalesShell>
      </AppErrorBoundary>

      <!-- Bottom TabBar -->
      <nav class="fixed right-0 bottom-0 left-0 z-40 border-t border-(--border-color) bg-(--bg-card)/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
        <div class="mx-auto flex h-14 max-w-screen-xl items-center justify-around">
          <router-link
            :to="`/sales/${accessToken}`"
            class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            :class="isOrderTab ? 'text-primary' : 'text-secondary'"
          >
            <AppIcon name="clipboard-document-list" class="size-5" :stroke-width="isOrderTab ? '2.5' : '1.5'" />
            <span class="text-[10px] font-medium">{{ t('salesTab.orders') }}</span>
          </router-link>
          <router-link
            :to="`/sales/${accessToken}/spaces`"
            class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            :class="isSpacesPage ? 'text-primary' : 'text-secondary'"
          >
            <AppIcon name="link" class="size-5" :stroke-width="isSpacesPage ? '2.5' : '1.5'" />
            <span class="text-[10px] font-medium">{{ t('salesTab.spaces') }}</span>
          </router-link>
        </div>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePushNotification } from '@/composables/usePushNotification';
import { useOrders } from '@/composables/useOrders';
import { useSalesOrderStateMachine } from '@/composables/sales/useSalesOrderStateMachine';
import { useNotifications } from '@/composables/useNotifications';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import OrderLogin from '@/components/order/OrderLogin.vue';
import SalesNotificationList from '@/components/order/SalesNotificationList.vue';
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue';
import AsyncStatePanel from '@/components/common/AsyncStatePanel.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import MobileSalesShell from '@/design-system/patterns/MobileSalesShell.vue';
import { resolveSalesOrderEntry, isSalesOrderV2Enabled } from '@/config/feature-flags';
import { onClickOutside } from '@vueuse/core';

const route = useRoute();
const router = useRouter();

const {
  salesLoading: ordersLoading,
  salesOrders: orders,
  checkSalesAuth,
  loginSales,
  loadSalesOrders,
  createSalesOrder,
  getSalesOrder,
  addSalesComment,
  salesPagination: ordersPagination,
} = useOrders();

const { t } = useI18n();
const { requestPermission, showOrderFeedbackNotification } = usePushNotification();
const {
  unreadCount: notificationUnreadCount,
  setSalesMode,
  startPolling: startNotificationPolling,
  stopPolling: stopNotificationPolling,
} = useNotifications();
const { subscribeModule } = useAppRefreshBus();
let stopSalesOrdersRefreshSubscription = null;

const accessToken = computed(() => route.params.token);

// Derived state for Header Actions
const isStatsPage = computed(() => route.path.endsWith('/stats'));
const isListPage = computed(() => route.path === `/sales/${accessToken.value}` || route.path === `/sales/${accessToken.value}/`);
const isSpacesPage = computed(() => route.path.endsWith('/spaces'));
const isOrderTab = computed(() => isListPage.value || route.path.includes('/create') || route.path.includes('/detail') || isStatsPage.value);

const pageTitle = computed(() => {
  if (isListPage.value) return t('order.portal.myOrders');
  if (route.path.includes('/create')) return t('order.portal.newOrder');
  if (route.path.includes('/detail')) return t('order.detail.title');
  if (route.path.includes('/stats')) return t('salesStats.title');
  if (isSpacesPage.value) return t('salesSpaces.title');
  return '';
});

const salesDescription = computed(() => salesperson.value?.name || '');

const salesOrderV2Enabled = computed(() => isSalesOrderV2Enabled());
const salesOrderEntry = computed(() => (salesOrderV2Enabled.value ? resolveSalesOrderEntry() : 'legacy'));

const salesOrderStateMachine = useSalesOrderStateMachine({
  loadOrders: async (payload = {}) => {
    const { page = 1, append = false } = payload;
    await loadSalesOrders(accessToken.value, page, append);
    return { ok: true, data: { orders: orders.value } };
  },
  createOrder: async (payload) => {
    const ok = await createSalesOrder(accessToken.value, payload);
    return ok ? { ok: true, data: null } : { ok: false, error: t('common.networkError') };
  },
  loadDetail: async ({ id } = {}) => {
    if (!id) return { ok: false, error: t('common.loadFailed') };
    const data = await getSalesOrder(accessToken.value, id);
    return data ? { ok: true, data } : { ok: false, error: t('common.loadFailed') };
  },
  comment: async ({ id, comment } = {}) => {
    if (!id || !comment) return { ok: false, error: t('common.loadFailed') };
    const ok = await addSalesComment(accessToken.value, id, comment);
    return ok ? { ok: true, data: null } : { ok: false, error: t('common.networkError') };
  },
});

// Auth State
const loading = ref(true);
const isAuthenticated = ref(false);
const loginError = ref('');
const salesperson = ref(null);
const prefillData = ref(null); // Shared state for duplicating order
let authRequestId = 0;

// 搜索状态（共享给子组件）
const searchQuery = ref('');

// Provide context to child views
provide('salesContext', {
    orders,
    loading: ordersLoading,
    salesperson,
    accessToken,
    loadOrders: (page, append) => salesOrderStateMachine.loadOrders({ page, append }),
    pagination: ordersPagination,
    prefillData,
    setPrefillData: (data) => { prefillData.value = data },
    searchQuery,
    salesOrderMode: salesOrderEntry,
    salesOrderV2Enabled,
    salesOrderStateMachine,
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

const handleBoundaryRecover = async () => {
  if (!isAuthenticated.value) {
    await checkAuth();
    return;
  }
  await salesOrderStateMachine.retry('loadOrders');
};

const activateSalesNotificationMode = () => {
  if (!accessToken.value) return;
  setSalesMode(accessToken.value);
  startNotificationPolling();
};

// Auth & Init
const checkAuth = async () => {
  const requestId = ++authRequestId;
  if (!accessToken.value) {
    stopNotificationPolling();
    if (requestId === authRequestId) {
      loading.value = false;
    }
    return;
  }
  const data = await checkSalesAuth(accessToken.value);
  if (requestId !== authRequestId) return;
  if (data) {
    isAuthenticated.value = true;
    salesperson.value = data;
    await salesOrderStateMachine.loadOrders();
    if (requestId !== authRequestId) return;
    activateSalesNotificationMode();
  }
  if (requestId === authRequestId) {
    loading.value = false;
  }
};

const handleLogin = async (password) => {
  const requestId = ++authRequestId;
  loginError.value = '';
  const result = await loginSales(accessToken.value, password);
  if (requestId !== authRequestId) return;
  if (result.success) {
    isAuthenticated.value = true;
    salesperson.value = result.data;
    await salesOrderStateMachine.loadOrders();
    if (requestId !== authRequestId) return;
    activateSalesNotificationMode();
  } else {
    loginError.value = result.message;
  }
};

watch(accessToken, () => {
  loading.value = true;
  isAuthenticated.value = false;
  salesperson.value = null;
  stopNotificationPolling();
  checkAuth();
});

onMounted(async () => {
  stopSalesOrdersRefreshSubscription = subscribeModule('salesOrders', async () => {
    if (isAuthenticated.value && isListPage.value) {
      const prevFeedbackIds = new Set(orders.value.filter((o) => o.hasNewFeedback).map((o) => o.id));
      await salesOrderStateMachine.loadOrders();

      orders.value.forEach((order) => {
        if (order.hasNewFeedback && !prevFeedbackIds.has(order.id)) {
          showOrderFeedbackNotification(order, () => {
            router.push(`/sales/${accessToken.value}/detail/${order.id}`);
          });
        }
      });
    }
  });

  await checkAuth();
  if (isAuthenticated.value) {
    requestPermission();
  }
});

onUnmounted(() => {
  stopNotificationPolling();
  stopSalesOrdersRefreshSubscription?.();
  stopSalesOrdersRefreshSubscription = null;
});
</script>
