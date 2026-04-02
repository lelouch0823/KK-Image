import { getAccessToken } from '../../utils/api';
import { getLoginMethod } from '../../utils/auth';
import { KEYS, store } from '../../utils/store';
import { handleMissingAccessToken } from '../../services/auth/session';
import { bindSalesWechat } from '../../services/sales/profile';
import { loadSalesStats, type SalesStatsPayload } from '../../services/sales/stats';
import {
  buildStatsViewModel,
  createEmptyStatsPayload,
  type StatsViewModel,
} from './controller';

type PageState = 'loading' | 'ready' | 'empty' | 'error';
type LoginMethod = 'password' | 'wechat' | null;
type AuthConfig = {
  wechatLoginEnabled?: boolean;
  salesWechatBound?: boolean;
};

function readAuthConfig(): AuthConfig {
  return (
    (store.get(KEYS.AUTH_CONFIG) as AuthConfig | undefined)
    || (wx.getStorageSync(KEYS.AUTH_CONFIG) as AuthConfig | undefined)
    || {}
  );
}

function persistAuthConfig(patch: Partial<AuthConfig>) {
  const next = {
    ...readAuthConfig(),
    ...patch,
  };
  store.set(KEYS.AUTH_CONFIG, next);
  wx.setStorageSync(KEYS.AUTH_CONFIG, next);
}

Page({
  data: {
    state: 'loading' as PageState,
    errorMessage: '',
    stats: createEmptyStatsPayload() as SalesStatsPayload,
    viewModel: null as StatsViewModel | null,
    bindingWechat: false,
  },

  onLoad() {
    const loginMethod = getLoginMethod();
    const authConfig = readAuthConfig();
    this.setData({
      viewModel: buildStatsViewModel(createEmptyStatsPayload(), {
        loginMethod,
        hideBindWechatAction: Boolean(authConfig.salesWechatBound),
      }),
    });
  },

  onShow() {
    void this.loadStats();
  },

  async onPullDownRefresh() {
    await this.loadStats();
    wx.stopPullDownRefresh();
  },

  getStatsViewModel(stats: SalesStatsPayload, loginMethod: LoginMethod = getLoginMethod()) {
    return buildStatsViewModel(stats, {
      loginMethod,
      hideBindWechatAction: Boolean(readAuthConfig().salesWechatBound),
    });
  },

  async loadStats() {
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
      const result = await loadSalesStats({ accessToken });
      if (!result.success || !result.data) {
        this.setData({
          state: 'error',
          errorMessage: result.error || '加载失败',
        });
        return;
      }

      const viewModel = this.getStatsViewModel(result.data);
      this.setData({
        stats: result.data,
        viewModel,
        state: viewModel.isEmpty ? 'empty' : 'ready',
      });
    } catch (_error) {
      this.setData({
        state: 'error',
        errorMessage: '加载失败',
      });
    }
  },

  async handleBindWechat() {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    if (this.data.bindingWechat) {
      return;
    }

    this.setData({ bindingWechat: true });
    try {
      const result = await bindSalesWechat({ accessToken });
      if (!result.success) {
        wx.showToast({
          title: result.error || '绑定失败',
          icon: 'none',
        });
        return;
      }

      persistAuthConfig({
        salesWechatBound: true,
        wechatLoginEnabled: true,
      });

      this.setData({
        viewModel: this.getStatsViewModel(this.data.stats, 'password'),
      });
      wx.showToast({
        title: '绑定成功',
        icon: 'success',
      });
    } finally {
      this.setData({ bindingWechat: false });
    }
  },

  handleRetry() {
    void this.loadStats();
  },

  handleBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/index/index' });
      },
    });
  },
});
