import { clearToken } from '../../utils/api';
import { STORAGE_KEYS } from '../../utils/constants';
import { KEYS, store } from '../../utils/store';

export type SalesLoginMethod = 'password' | 'wechat';

export interface SalesUser {
  id: string;
  name: string;
  store?: string;
}

interface SessionUserResult {
  success: boolean;
  data?: SalesUser;
  error?: string;
}

interface ClearSalesSessionOptions {
  clearAccessToken?: boolean;
  redirectToLogin?: boolean;
}

export interface RestoreSessionOptions {
  accessToken?: string | null;
  getCurrentUser: (accessToken: string) => Promise<SessionUserResult>;
}

export function persistSalesUser(user: SalesUser): void {
  wx.setStorageSync(STORAGE_KEYS.USER_INFO, user);
  store.set(KEYS.USER, user);
}

export function persistLoginMethod(method: SalesLoginMethod): void {
  wx.setStorageSync(KEYS.LOGIN_METHOD, method);
  store.set(KEYS.LOGIN_METHOD, method);
}

export function clearSalesSession(options: ClearSalesSessionOptions = {}): void {
  const { clearAccessToken = false, redirectToLogin = false } = options;

  clearToken();
  wx.removeStorageSync(STORAGE_KEYS.USER_INFO);
  wx.removeStorageSync(KEYS.LOGIN_METHOD);
  store.set(KEYS.USER, null);
  store.set(KEYS.TOKEN, null);
  store.set(KEYS.LOGIN_METHOD, null);

  if (clearAccessToken) {
    wx.removeStorageSync(STORAGE_KEYS.ACCESS_TOKEN);
  }

  if (redirectToLogin) {
    wx.reLaunch({ url: '/pages/login/login' });
  }
}

export async function restoreSalesSession({
  accessToken,
  getCurrentUser,
}: RestoreSessionOptions) {
  if (!accessToken) {
    return { ok: false, reason: 'missing_access_token' } as const;
  }

  const result = await getCurrentUser(accessToken);
  if (!result.success || !result.data) {
    clearSalesSession();
    return { ok: false, reason: result.error || 'expired' } as const;
  }

  persistSalesUser(result.data);
  return { ok: true, user: result.data } as const;
}
