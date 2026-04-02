/**
 * 登录页
 */

import { getCurrentUser, getLoginMethod, usernameLogin, wxLogin } from '../../utils/auth';
import { KEYS, store } from '../../utils/store';

interface AuthConfig {
  wechatLoginEnabled?: boolean;
}

function getAuthConfig(): AuthConfig {
  const stateConfig = store.get(KEYS.AUTH_CONFIG) as AuthConfig | undefined;
  if (stateConfig) {
    return stateConfig;
  }

  const storageConfig = wx.getStorageSync(KEYS.AUTH_CONFIG) as AuthConfig | undefined;
  if (storageConfig) {
    store.set(KEYS.AUTH_CONFIG, storageConfig);
    return storageConfig;
  }

  return {};
}

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    wechatLoading: false,
    error: '',
    activeMethod: 'password',
    canWechatLogin: true,
  },

  onLoad() {
    if (getCurrentUser()) {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }

    const config = getAuthConfig();
    const loginMethod = getLoginMethod();
    this.setData({
      canWechatLogin: config.wechatLoginEnabled !== false,
      activeMethod: loginMethod || 'password',
    });
  },

  onSelectMethod(e: WechatMiniprogram.TouchEvent) {
    const method = String(e.currentTarget.dataset.method || 'password');
    this.setData({ activeMethod: method, error: '' });
  },

  async handleLogin() {
    const { username, password } = this.data;

    if (!username.trim()) {
      this.setData({ error: '请输入手机号或姓名' });
      return;
    }

    if (!password.trim()) {
      this.setData({ error: '请输入密码' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const result = await usernameLogin(username.trim(), password);
      if (result.success) {
        this.enterApp();
        return;
      }

      this.setData({ error: result.message || '登录失败' });
    } catch (error: any) {
      this.setData({ error: error.message || '登录失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleWechatLogin() {
    if (!this.data.canWechatLogin) {
      return;
    }

    this.setData({ wechatLoading: true, error: '' });
    try {
      const result = await wxLogin();
      if (result.success) {
        this.enterApp();
        return;
      }

      this.setData({
        activeMethod: result.needBind ? 'password' : this.data.activeMethod,
        error: result.message || '微信登录失败',
      });
    } catch (error: any) {
      this.setData({ error: error.message || '微信登录失败' });
    } finally {
      this.setData({ wechatLoading: false });
    }
  },

  onInput(e: WechatMiniprogram.CustomEvent) {
    const field = String(e.currentTarget.dataset.field || '');
    const value = String(e.detail.value || '');
    this.setData({ [field]: value, error: '' });
  },

  enterApp() {
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' });
    }, 300);
  },
});
