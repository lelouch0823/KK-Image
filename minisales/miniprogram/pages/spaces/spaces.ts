import { getAccessToken } from '../../utils/api';
import { calculateNavBarHeight, getNavbarVisibility, initTabBar } from '../../utils/ui-helpers';
import { handleMissingAccessToken } from '../../services/auth/session';
import { loadSalesSpaces } from '../../services/sales/spaces';
import { buildSpacesGridModel, type SpaceCardViewModel } from './controller';

type PageState = 'loading' | 'ready' | 'empty' | 'error';

Page({
  data: {
    state: 'loading' as PageState,
    errorMessage: '',
    spaces: [] as SpaceCardViewModel[],
    statusBarHeight: 20,
    navBarHeight: 88,
    navBarVisible: true,
    unreadCount: 0,
  },

  lastScrollTop: 0,

  onLoad() {
    const { totalHeight, statusBarHeight } = calculateNavBarHeight();
    this.setData({
      statusBarHeight,
      navBarHeight: totalHeight,
    });
  },

  onShow() {
    initTabBar(this);
    void this.loadSpaces();
  },

  onShellLayout(e: WechatMiniprogram.CustomEvent<{ height?: number }>) {
    const height = Number(e.detail?.height || 0);
    if (height > 0 && Math.abs(height - this.data.navBarHeight) > 1) {
      this.setData({ navBarHeight: Math.ceil(height) });
    }
  },

  async onPullDownRefresh() {
    await this.loadSpaces();
    wx.stopPullDownRefresh();
  },

  onScroll(e: WechatMiniprogram.ScrollViewScroll) {
    const scrollTop = e.detail.scrollTop;
    const shouldShow = getNavbarVisibility(
      scrollTop,
      this.lastScrollTop,
      this.data.navBarVisible,
      this.data.navBarHeight
    );

    if (shouldShow !== null) {
      this.setData({ navBarVisible: shouldShow });
    }

    this.lastScrollTop = scrollTop;
  },

  async loadSpaces() {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    this.setData({
      state: 'loading',
      errorMessage: '',
    });

    try {
      const result = await loadSalesSpaces({ accessToken });
      if (!result.success || !result.data) {
        this.setData({
          state: 'error',
          errorMessage: result.error || '加载失败',
        });
        return;
      }

      const spaces = buildSpacesGridModel(result.data);
      this.setData({
        spaces,
        state: spaces.length ? 'ready' : 'empty',
      });
    } catch (_error) {
      this.setData({
        state: 'error',
        errorMessage: '加载失败',
      });
    }
  },

  handleViewSpace(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '');
    if (!id) {
      return;
    }

    wx.navigateTo({ url: `/pages/spaces_detail/detail?id=${id}` });
  },

  handleRetry() {
    void this.loadSpaces();
  },

  onShellNavigate(e: WechatMiniprogram.CustomEvent<{ target: string }>) {
    const target = String(e.detail.target || '');
    if (target === 'orders') {
      wx.switchTab({ url: '/pages/index/index' });
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
