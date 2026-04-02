import { get, getAccessToken, getFileUrl, getToken } from '../../utils/api';
import { calculateNavBarHeight, getNavbarVisibility, initTabBar } from '../../utils/ui-helpers';
import { getCurrentUser, logout } from '../../utils/auth';
import { API, STATUS_CONFIG, OrderStatus } from '../../utils/constants';
import { store, KEYS } from '../../utils/store';
import { handleMissingAccessToken, handleSalesSessionExpired } from '../../services/auth/session';

// ... (Interface Order remain same)
interface Order {
  id: string;
  orderNo: string;
  name?: string; // Add name if missing from previous snippet
  status: OrderStatus;
  customerName?: string;
  mainImage?: string;
  hasNewFeedback?: boolean;
  createdAt: number;
  updatedAt: number;
}

Page({
  data: {
    orders: [] as Order[],
    loading: true,
    refreshing: false,
    user: null as { name: string; store?: string } | null,
    statusConfig: STATUS_CONFIG,
    // 导航栏布局信息
    statusBarHeight: 20,
    navContentHeight: 44,
    headerHeight: 64,

    // FAB 按钮状态
    fabVisible: true,
    // Navbar auto-hide
    navBarVisible: true,
    // Skeleton 配置
    rowCol: [
      [{ size: '128rpx', borderRadius: '12rpx' }],
      [{ width: '60%', height: '32rpx', marginBottom: '16rpx' }],
      [{ width: '40%', height: '24rpx' }],
    ],
    unreadCount: 0,
  },

  // 滚动状态记录
  lastScrollTop: 0,
  // 监听器销毁函数
  unsubUser: null as null | (() => void),

  onLoad() {
    this.checkAuth();

    // 订阅用户信息变化
    this.unsubUser = store.on(KEYS.USER, (user) => {
      this.setData({ user });
      if (user) {
        this.loadOrders();
      }
    });

    // 计算自定义导航栏高度
    const { totalHeight, statusBarHeight, navContentHeight } = calculateNavBarHeight();
    this.setData({
      statusBarHeight,
      navContentHeight,
      headerHeight: totalHeight,
    });
  },

  onShow() {
    initTabBar(this);

    const user = getCurrentUser();
    if (user && this.data.orders.length === 0) {
      this.loadOrders();
    }
  },

  onShellLayout(e: WechatMiniprogram.CustomEvent<{ height?: number }>) {
    const height = Number(e.detail?.height || 0);
    if (height > 0 && Math.abs(height - this.data.headerHeight) > 1) {
      this.setData({ headerHeight: Math.ceil(height) });
    }
  },

  onUnload() {
    if (this.unsubUser) {
      this.unsubUser();
    }
  },

  /**
   * 监听滚动
   */
  onScroll(e: WechatMiniprogram.ScrollViewScroll) {
    const currentScrollTop = e.detail.scrollTop;
    if (currentScrollTop < 0) return;

    const { navBarVisible, headerHeight } = this.data;
    const lastScrollTop = this.lastScrollTop;

    const shouldShowNavbar = getNavbarVisibility(
      currentScrollTop,
      lastScrollTop,
      navBarVisible,
      headerHeight
    );

    if (shouldShowNavbar !== null) {
      this.setData({
        navBarVisible: shouldShowNavbar,
        fabVisible: shouldShowNavbar
      });
    }

    this.lastScrollTop = currentScrollTop;
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    this.setData({ refreshing: true });
    await this.loadOrders();
    wx.stopPullDownRefresh();
    this.setData({ refreshing: false });
  },

  /**
   * 检查登录状态
   */
  checkAuth() {
    const user = getCurrentUser();
    if (!user) {
      const token = getToken();
      const accessToken = getAccessToken();
      if (token && accessToken) {
        return;
      }

      if (!accessToken) {
        handleMissingAccessToken();
        return;
      }

      handleSalesSessionExpired();
      return;
    }
    this.setData({ user });
    this.loadOrders();
  },

  /**
   * 加载订单列表
   */
  async loadOrders() {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    this.setData({ loading: true });

    try {
      const response = await get<{ orders: Order[] }>(API.SALES_ORDERS(accessToken));

      if (response.success && response.data) {
        const rawOrders = response.data.orders || (response.data as any);
        const orders = Array.isArray(rawOrders) ? rawOrders.map(o => ({
          ...o,
          mainImage: getFileUrl(o.mainImage)
        })) : [];

        this.setData({ orders });
      }
    } catch (error) {
      console.error('Load orders failed:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 新建订单
   */
  handleNewOrder() {
    wx.navigateTo({ url: '/pages/form/form' });
  },

  /**
   * 查看订单详情
   */
  handleViewOrder(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout();
        }
      },
    });
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

  onShellNotifications() {
    wx.showToast({ title: '通知功能建设中', icon: 'none' });
  },
});
