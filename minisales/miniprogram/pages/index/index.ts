/**
 * 订单列表页 (首页)
 */

import { get, getAccessToken } from '../../utils/api';
import { getCurrentUser, logout } from '../../utils/auth';
import { API, STATUS_CONFIG, OrderStatus } from '../../utils/constants';
import { store, KEYS } from '../../utils/store';

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
    const sysInfo = wx.getSystemInfoSync();
    const menuInfo = wx.getMenuButtonBoundingClientRect();

    const statusBarHeight = sysInfo.statusBarHeight;
    // 导航栏内容高度 = (胶囊顶部 - 状态栏高度) * 2 + 胶囊高度
    const navContentHeight = (menuInfo.top - statusBarHeight) * 2 + menuInfo.height;

    this.setData({
      statusBarHeight,
      navContentHeight,
      headerHeight: statusBarHeight + navContentHeight,
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      (this.getTabBar() as any).init();
    }

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

    // 向下滚动隐藏 (阈值 20px)
    if (currentScrollTop > this.lastScrollTop + 20 && this.data.fabVisible) {
      this.setData({ fabVisible: false });
    }
    // 向上滚动显示 (阈值 20px)
    else if (currentScrollTop < this.lastScrollTop - 20 && !this.data.fabVisible) {
      this.setData({ fabVisible: true });
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
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // 今天
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 一周内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      return `周${days[date.getDay()]}`;
    }

    // 更早
    return `${date.getMonth() + 1}/${date.getDate()}`;
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
