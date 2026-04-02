/**
 * 登录页
 */

import { bindWechat, getCurrentUser, getLoginMethod, passwordLogin, usernameLogin, wxLogin } from '../../utils/auth';
import { getAccessToken } from '../../utils/api';
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

function persistWechatLoginEnabled(enabled: boolean) {
  const current = (store.get(KEYS.AUTH_CONFIG) as AuthConfig | undefined)
    || (wx.getStorageSync(KEYS.AUTH_CONFIG) as AuthConfig | undefined)
    || {};
  const next = { ...current, wechatLoginEnabled: enabled };
  store.set(KEYS.AUTH_CONFIG, next);
  wx.setStorageSync(KEYS.AUTH_CONFIG, next);
}

function isWechatNotConfigured(message?: string): boolean {
  return !!message && message.includes('微信登录未配置');
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
    isScopedLogin: false,
    pendingWechatBind: false,
  },

  onLoad() {
    if (getCurrentUser()) {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }

    const config = getAuthConfig();
    const loginMethod = getLoginMethod();
    const scopedAccessToken = getAccessToken();
    const isScopedLogin = !!scopedAccessToken;
    const canWechatLogin = config.wechatLoginEnabled !== false && isScopedLogin;
    const activeMethod = loginMethod === 'wechat' && !canWechatLogin
      ? 'password'
      : (loginMethod || 'password');
    this.setData({
      isScopedLogin,
      canWechatLogin,
      activeMethod,
    });
  },

  onSelectMethod(e: WechatMiniprogram.TouchEvent) {
    const method = String(e.currentTarget.dataset.method || 'password');
    if (method === 'wechat' && !this.data.canWechatLogin) {
      return;
    }
    this.setData({ activeMethod: method, error: '' });
  },

  async handleLogin() {
    const { username, password } = this.data;
    const scopedAccessToken = getAccessToken();
    const isScopedLogin = !!scopedAccessToken;

    if (!isScopedLogin && !username.trim()) {
      this.setData({ error: '请输入手机号或姓名' });
      return;
    }

    if (!password.trim()) {
      this.setData({ error: '请输入密码' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const result = isScopedLogin
        ? await passwordLogin(scopedAccessToken as string, password)
        : await usernameLogin(username.trim(), password);
      if (result.success) {
        if (this.data.pendingWechatBind) {
          const accessToken = getAccessToken();
          if (accessToken) {
            const bindResult = await bindWechat(accessToken);
            if (!bindResult.success) {
              if (isWechatNotConfigured(bindResult.message)) {
                persistWechatLoginEnabled(false);
                this.setData({ canWechatLogin: false, activeMethod: 'password' });
              }
              wx.showToast({ title: bindResult.message || '微信绑定失败，可稍后重试', icon: 'none' });
            } else {
              persistWechatLoginEnabled(true);
            }
          }
        }

        this.setData({ pendingWechatBind: false });
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
        persistWechatLoginEnabled(true);
        this.enterApp();
        return;
      }

      if (result.needBind) {
        persistWechatLoginEnabled(true);
      }

      if (isWechatNotConfigured(result.message)) {
        persistWechatLoginEnabled(false);
      }

      this.setData({
        pendingWechatBind: !!result.needBind,
        canWechatLogin: isWechatNotConfigured(result.message) ? false : this.data.canWechatLogin,
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
