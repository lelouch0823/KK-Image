/**
 * 认证工具模块
 * 处理微信登录和密码登录
 */

import { post, getAccessToken, setAccessToken, setToken } from './api';
import { API, STORAGE_KEYS } from './constants';
import { KEYS, store } from './store';
import {
  clearSalesSession,
  persistLoginMethod,
  persistSalesUser,
  restoreSalesSession,
  type SalesUser,
} from '../services/auth/session';

interface LoginResult {
  success: boolean;
  user?: SalesUser;
  needBind?: boolean;
  openid?: string;
  message?: string;
}

interface AuthUserResponse {
  id: string;
  name: string;
  store?: string;
}

function normalizeUser(payload: AuthUserResponse): SalesUser {
  return {
    id: payload.id,
    name: payload.name,
    store: payload.store,
  };
}

function isAuthInvalidError(error?: string): boolean {
  if (!error) {
    return false;
  }

  const normalized = error.toLowerCase();
  return (
    normalized.includes('expired') ||
    normalized.includes('unauthorized') ||
    normalized.includes('invalid_token') ||
    normalized.includes('登录已过期')
  );
}

/**
 * 微信一键登录
 * 流程: wx.login -> 获取 code -> 发送到后端 -> 获取 JWT
 */
export async function wxLogin(): Promise<LoginResult> {
  try {
    const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject,
      });
    });

    if (!loginRes.code) {
      return { success: false, message: '获取微信登录凭证失败' };
    }

    const response = await post<{
      token?: string;
      accessToken?: string;
      expiresIn?: number;
      user?: SalesUser;
      needBind?: boolean;
      openid?: string;
    }>(API.WECHAT_LOGIN, { code: loginRes.code });

    if (!response.success || !response.data) {
      return { success: false, message: response.error || '登录失败' };
    }

    const data = response.data;
    if (data.needBind) {
      return {
        success: false,
        needBind: true,
        openid: data.openid,
        message: '账号未绑定微信，请使用密码登录后绑定',
      };
    }

    if (!data.token || !data.accessToken || !data.user) {
      return {
        success: false,
        message: '微信登录信息不完整，请改用账号密码登录',
      };
    }

    setToken(data.token);
    store.set(KEYS.TOKEN, data.token);
    setAccessToken(data.accessToken);
    persistSalesUser(data.user);
    persistLoginMethod('wechat');

    return {
      success: true,
      user: data.user,
    };
  } catch (error: any) {
    console.error('WeChat login error:', error);
    return { success: false, message: error.message || '微信登录失败' };
  }
}

/**
 * 密码登录 (通过 accessToken URL)
 * @param accessToken - URL 中的 token
 * @param password - 密码
 */
export async function passwordLogin(accessToken: string, password: string): Promise<LoginResult> {
  try {
    const response = await post<{
      id: string;
      name: string;
      store?: string;
      token: string;
      expiresIn: number;
    }>(API.SALES_AUTH(accessToken), { password });

    if (!response.success || !response.data) {
      return { success: false, message: response.error || '登录失败' };
    }

    const data = response.data;
    const user = normalizeUser(data);
    setToken(data.token);
    setAccessToken(accessToken);
    store.set(KEYS.TOKEN, data.token);
    persistSalesUser(user);
    persistLoginMethod('password');

    return { success: true, user };
  } catch (error: any) {
    console.error('Password login error:', error);
    return { success: false, message: error.message || '登录失败' };
  }
}

/**
 * 用户名密码登录 (手机号/姓名 + 密码)
 * @param username - 手机号或姓名
 * @param password - 密码
 */
export async function usernameLogin(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await post<{
      id: string;
      name: string;
      store?: string;
      token: string;
      accessToken: string;
      expiresIn: number;
    }>(API.SALES_LOGIN, { username, password });

    if (!response.success || !response.data) {
      return { success: false, message: response.error || '登录失败' };
    }

    const data = response.data;
    const user = normalizeUser(data);
    setToken(data.token);
    setAccessToken(data.accessToken);
    store.set(KEYS.TOKEN, data.token);
    persistSalesUser(user);
    persistLoginMethod('password');

    return { success: true, user };
  } catch (error: any) {
    console.error('Username login error:', error);
    return { success: false, message: error.message || '登录失败' };
  }
}

export async function fetchCurrentSalesUser(accessToken: string): Promise<{
  success: boolean;
  data?: SalesUser;
  error?: string;
  isAuthInvalid?: boolean;
}> {
  try {
    const response = await post<AuthUserResponse>(API.SALES_AUTH(accessToken), {});
    if (response.success && response.data) {
      return {
        success: true,
        data: normalizeUser(response.data),
      };
    }

    return {
      success: false,
      error: response.error || response.message || 'expired',
      isAuthInvalid: isAuthInvalidError(response.error || response.message || 'expired'),
    };
  } catch (error: any) {
    const errorMessage = error?.message || 'network_error';
    return {
      success: false,
      error: errorMessage,
      isAuthInvalid: isAuthInvalidError(errorMessage),
    };
  }
}

/**
 * 检查登录状态
 */
export async function checkAuth(): Promise<SalesUser | null> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    clearSalesSession();
    return null;
  }

  const restored = await restoreSalesSession({
    accessToken,
    getCurrentUser: fetchCurrentSalesUser,
  });

  if (restored.ok) {
    return restored.user;
  }

  return null;
}

/**
 * 退出登录
 */
export function logout(): void {
  clearSalesSession({ clearAccessToken: true, redirectToLogin: true });
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser(): SalesUser | null {
  const user = (wx.getStorageSync(STORAGE_KEYS.USER_INFO) as SalesUser | undefined) || null;
  if (user && !store.get(KEYS.USER)) {
    store.set(KEYS.USER, user);
  }
  return user;
}

/**
 * 获取上次登录方式
 */
export function getLoginMethod(): 'password' | 'wechat' | null {
  const method = (wx.getStorageSync(KEYS.LOGIN_METHOD) as 'password' | 'wechat' | undefined) || null;
  if (method && !store.get(KEYS.LOGIN_METHOD)) {
    store.set(KEYS.LOGIN_METHOD, method);
  }
  return method;
}

/**
 * 绑定微信
 * @param accessToken - URL 中的 token
 */
export async function bindWechat(accessToken: string): Promise<{ success: boolean; message?: string }> {
  try {
    const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject,
      });
    });

    if (!loginRes.code) {
      return { success: false, message: '获取微信登录凭证失败' };
    }

    const response = await post(API.SALES_BIND_WECHAT(accessToken), { code: loginRes.code });

    if (response.success) {
      return { success: true };
    }

    return { success: false, message: response.error || '绑定失败' };
  } catch (error: any) {
    return { success: false, message: error.message || '绑定失败' };
  }
}
