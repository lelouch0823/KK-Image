/**
 * 订单列表页 (首页)
 */

import { get, getAccessToken } from '../../utils/api';
import { formatFriendlyTime } from '../../utils/helpers';
import { calculateNavBarHeight, getNavbarVisibility, initTabBar } from '../../utils/ui-helpers';
import { getCurrentUser, logout } from '../../utils/auth';
import { API, STATUS_CONFIG, OrderStatus } from '../../utils/constants';
import { store, KEYS } from '../../utils/store';

// ... (Interface Order)
interface Order {
  id: string;
  orderNo: string;
  status: OrderStatus;
  customerName?: string;
  mainImage?: string;
  hasNewFeedback?: boolean;
  createdAt: number;
  updatedAt: number;
  // ... other fields
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
    const { statusBarHeight, navContentHeight, totalHeight } = calculateNavBarHeight();

    this.setData({
      statusBarHeight,
      navContentHeight,
      headerHeight: totalHeight,
    });
  },

  onShow() {
    initTabBar(this);

    // 移除 onShow 中的 checkAuth，交由 store 管理
    const user = getCurrentUser(); // 确保 store 有值
    if (user && this.data.orders.length === 0) {
      this.loadOrders();
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

    // Use Helper for Navbar
    // Use Helper for Navbar
    const { navBarVisible, headerHeight } = this.data;
    const lastScrollTop = this.lastScrollTop; // Instance property

    const shouldShowNavbar = getNavbarVisibility(
      currentScrollTop,
      lastScrollTop,
      navBarVisible,
      headerHeight
    );

    if (shouldShowNavbar !== null) {
      this.setData({ navBarVisible: shouldShowNavbar });
    }

    // FAB follows Navbar logic roughly, or can be separate. 
    // Usually FAB hides when scrolling down, shows when up.
    // If Navbar hides, FAB hides. If Navbar shows, FAB shows.
    // Sync FAB with Navbar visibility for cleaner UX
    if (shouldShowNavbar !== null) {
      this.setData({ fabVisible: shouldShowNavbar });
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
      wx.redirectTo({ url: '/pages/login/login' });
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
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }

    this.setData({ loading: true });

    try {
      const response = await get<{ orders: Order[] }>(API.SALES_ORDERS(accessToken));

      if (response.success && response.data) {
        this.setData({ orders: response.data.orders || response.data });
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
   * 格式化时间
   */
  formatTime(timestamp: number): string {
    // 使用统一的 helper 函数
    return formatFriendlyTime(timestamp);
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
});
