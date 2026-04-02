import { getAccessToken } from '../../utils/api';
import { getCurrentUser } from '../../utils/auth';
import { calculateNavBarHeight, getNavbarVisibility, initTabBar } from '../../utils/ui-helpers';
import { store, KEYS } from '../../utils/store';
import { handleMissingAccessToken } from '../../services/auth/session';
import {
  loadSalesOrders,
  type SalesPagination,
} from '../../services/sales/orders';
import {
  countUnreadNotifications,
  loadSalesNotifications,
  markAllSalesNotificationsRead,
  markSalesNotificationRead,
} from '../../services/sales/notifications';
import type { NormalizedSalesOrderSummary } from '../../utils/normalize/order';
import type { NormalizedSalesNotification } from '../../utils/normalize/notification';
import { buildOrdersListState, filterOrdersBySearch } from './controller';

type PageState = 'loading' | 'ready' | 'empty' | 'error';

interface SalesUserInfo {
  name: string;
  store?: string;
}

function defaultPagination(): SalesPagination {
  return {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };
}

function normalizeInputValue(event: WechatMiniprogram.CustomEvent<{ value?: string }> | any): string {
  const detail = event?.detail;
  if (typeof detail?.value === 'string') {
    return detail.value;
  }
  if (typeof detail === 'string') {
    return detail;
  }
  return '';
}

function resolveNotificationOrderId(notification: Partial<NormalizedSalesNotification>): string {
  if (notification.orderId) {
    return notification.orderId;
  }

  const metadata = notification.metadata as Record<string, unknown> | null;
  const metadataOrderId = typeof metadata?.orderId === 'string' ? metadata.orderId : '';
  if (metadataOrderId) {
    return metadataOrderId;
  }

  const link = String(notification.link || '');
  if (!link) {
    return '';
  }

  const segments = link.split('/').filter(Boolean);
  const detailIndex = segments.indexOf('detail');
  if (detailIndex >= 0 && segments[detailIndex + 1]) {
    return segments[detailIndex + 1];
  }

  const orderIndex = segments.indexOf('orders');
  if (orderIndex >= 0 && segments[orderIndex + 1]) {
    return segments[orderIndex + 1];
  }

  return '';
}

Page({
  data: {
    user: null as SalesUserInfo | null,
    orders: [] as NormalizedSalesOrderSummary[],
    visibleOrders: [] as NormalizedSalesOrderSummary[],
    pagination: defaultPagination(),
    canLoadMore: false,
    searchQuery: '',

    notifications: [] as NormalizedSalesNotification[],
    unreadCount: 0,
    notificationsLoading: false,
    notificationsError: '',

    state: 'loading' as PageState,
    loading: false,
    loadingMore: false,
    refreshing: false,
    errorMessage: '',

    statusBarHeight: 20,
    headerHeight: 64,
    navBarVisible: true,
    fabVisible: true,
  },

  lastScrollTop: 0,
  unsubUser: null as null | (() => void),

  onLoad() {
    const { totalHeight, statusBarHeight } = calculateNavBarHeight();
    this.setData({
      statusBarHeight,
      headerHeight: totalHeight,
      user: getCurrentUser(),
    });

    this.unsubUser = store.on(KEYS.USER, (user) => {
      this.setData({ user: (user as SalesUserInfo) || null });
    });
  },

  async onShow() {
    initTabBar(this);
    await this.loadInitialData();
  },

  onUnload() {
    if (this.unsubUser) {
      this.unsubUser();
      this.unsubUser = null;
    }
  },

  onShellLayout(e: WechatMiniprogram.CustomEvent<{ height?: number }>) {
    const height = Number(e.detail?.height || 0);
    if (height > 0 && Math.abs(height - this.data.headerHeight) > 1) {
      this.setData({ headerHeight: Math.ceil(height) });
    }
  },

  onScroll(e: WechatMiniprogram.ScrollViewScroll) {
    const currentScrollTop = e.detail.scrollTop;
    if (currentScrollTop < 0) {
      return;
    }

    const shouldShowNavbar = getNavbarVisibility(
      currentScrollTop,
      this.lastScrollTop,
      this.data.navBarVisible,
      this.data.headerHeight
    );

    if (shouldShowNavbar !== null) {
      this.setData({
        navBarVisible: shouldShowNavbar,
        fabVisible: shouldShowNavbar,
      });
    }

    this.lastScrollTop = currentScrollTop;
  },

  async onPullDownRefresh() {
    this.setData({ refreshing: true });
    await this.loadInitialData();
    wx.stopPullDownRefresh();
    this.setData({ refreshing: false });
  },

  async loadInitialData() {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    this.setData({
      loading: true,
      state: 'loading',
      errorMessage: '',
    });

    try {
      const [ordersResult, notificationsResult] = await Promise.all([
        loadSalesOrders({ accessToken, page: 1, limit: 20 }),
        loadSalesNotifications({ accessToken, limit: 20 }),
      ]);

      if (!ordersResult.success || !ordersResult.data) {
        this.setData({
          loading: false,
          state: 'error',
          errorMessage: ordersResult.error || '加载失败',
          unreadCount: notificationsResult.success && notificationsResult.data
            ? countUnreadNotifications(notificationsResult.data)
            : 0,
          notifications: notificationsResult.success && notificationsResult.data
            ? notificationsResult.data.list
            : [],
          notificationsError: notificationsResult.success ? '' : (notificationsResult.error || ''),
        });
        return;
      }

      const nextState = buildOrdersListState([], ordersResult.data, false);
      const visibleOrders = filterOrdersBySearch(nextState.orders, this.data.searchQuery);
      this.setData({
        ...nextState,
        visibleOrders,
        notifications: notificationsResult.success && notificationsResult.data
          ? notificationsResult.data.list
          : [],
        unreadCount: notificationsResult.success && notificationsResult.data
          ? countUnreadNotifications(notificationsResult.data)
          : 0,
        notificationsError: notificationsResult.success ? '' : (notificationsResult.error || ''),
        loading: false,
        state: nextState.orders.length ? 'ready' : 'empty',
      });
    } catch (_error) {
      this.setData({
        loading: false,
        state: 'error',
        errorMessage: '加载失败',
      });
    }
  },

  async refreshNotifications(withLoading = false) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      return;
    }

    if (withLoading) {
      this.setData({ notificationsLoading: true });
    }

    try {
      const result = await loadSalesNotifications({ accessToken, limit: 20 });
      if (!result.success || !result.data) {
        this.setData({
          notificationsError: result.error || '通知加载失败',
        });
        return;
      }

      this.setData({
        notifications: result.data.list,
        unreadCount: countUnreadNotifications(result.data),
        notificationsError: '',
      });
    } finally {
      if (withLoading) {
        this.setData({ notificationsLoading: false });
      }
    }
  },

  onSearchChange(e: WechatMiniprogram.CustomEvent<{ value?: string }>) {
    const searchQuery = normalizeInputValue(e);
    this.setData({
      searchQuery,
      visibleOrders: filterOrdersBySearch(this.data.orders, searchQuery),
    });
  },

  async onLoadMore() {
    if (
      this.data.loading ||
      this.data.loadingMore ||
      !this.data.canLoadMore ||
      this.data.searchQuery.trim()
    ) {
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    this.setData({ loadingMore: true });
    try {
      const result = await loadSalesOrders({
        accessToken,
        page: this.data.pagination.page + 1,
        limit: this.data.pagination.limit,
      });

      if (!result.success || !result.data) {
        wx.showToast({ title: result.error || '加载失败', icon: 'none' });
        return;
      }

      const nextState = buildOrdersListState(this.data.orders, result.data, true);
      this.setData({
        ...nextState,
        visibleOrders: filterOrdersBySearch(nextState.orders, this.data.searchQuery),
      });
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  handleNewOrder() {
    wx.navigateTo({ url: '/pages/form/form' });
  },

  handleViewOrder(e: WechatMiniprogram.CustomEvent<{ id?: string }> | WechatMiniprogram.TouchEvent) {
    const detail = (e as WechatMiniprogram.CustomEvent<{ id?: string }>).detail;
    const dataset = (e as WechatMiniprogram.TouchEvent).currentTarget?.dataset;
    const id = String(detail?.id || dataset?.id || '');
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  onShellNavigate(e: WechatMiniprogram.CustomEvent<{ target: string }>) {
    const target = String(e.detail.target || '');
    if (target === 'spaces') {
      wx.switchTab({ url: '/pages/spaces/spaces' });
      return;
    }

    if (target === 'stats') {
      wx.navigateTo({ url: '/pages/stats/stats' });
    }
  },

  onShellNotifications(e: WechatMiniprogram.CustomEvent<{ open?: boolean }>) {
    if (e.detail?.open) {
      void this.refreshNotifications(this.data.notifications.length === 0);
    }
  },

  onShellNotificationRetry() {
    void this.refreshNotifications(true);
  },

  async onShellNotificationMarkAll() {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    const result = await markAllSalesNotificationsRead({ accessToken });
    if (!result.success) {
      wx.showToast({ title: result.error || '操作失败', icon: 'none' });
      return;
    }

    this.setData({
      notifications: this.data.notifications.map((item) => ({
        ...item,
        unread: false,
        isRead: true,
        is_read: 1,
      })),
      unreadCount: 0,
    });
  },

  async onShellNotificationSelect(
    e: WechatMiniprogram.CustomEvent<{ notification?: Partial<NormalizedSalesNotification> }>
  ) {
    const notification = e.detail?.notification;
    if (!notification) {
      return;
    }

    const accessToken = getAccessToken();
    if (accessToken && notification.id && (notification.unread ?? notification.is_read !== 1)) {
      await markSalesNotificationRead({
        accessToken,
        notificationId: notification.id,
      });
    }

    const orderId = resolveNotificationOrderId(notification);
    if (orderId) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${orderId}` });
    }

    void this.refreshNotifications(false);
  },

  onRetryList() {
    void this.loadInitialData();
  },
});
