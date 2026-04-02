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
  isAuthInvalid?: boolean;
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

  wx.removeStorageSync(STORAGE_KEYS.TOKEN);
  wx.removeStorageSync(STORAGE_KEYS.USER_INFO);
  wx.removeStorageSync(KEYS.LOGIN_METHOD);
  wx.removeStorageSync(KEYS.AUTH_CONFIG);
  store.set(KEYS.USER, null);
  store.set(KEYS.TOKEN, null);
  store.set(KEYS.LOGIN_METHOD, null);
  store.set(KEYS.AUTH_CONFIG, null);

  if (clearAccessToken) {
    wx.removeStorageSync(STORAGE_KEYS.ACCESS_TOKEN);
  }

  if (redirectToLogin) {
    wx.reLaunch({ url: '/pages/login/login' });
  }
}

export function applyInboundAccessToken(inboundAccessToken?: string | null): {
  applied: boolean;
  changed: boolean;
} {
  if (!inboundAccessToken) {
    return { applied: false, changed: false };
  }

  const currentAccessToken = (wx.getStorageSync(STORAGE_KEYS.ACCESS_TOKEN) as string | undefined) || '';
  if (currentAccessToken === inboundAccessToken) {
    return { applied: false, changed: false };
  }

  if (currentAccessToken) {
    clearSalesSession();
  }

  wx.setStorageSync(STORAGE_KEYS.ACCESS_TOKEN, inboundAccessToken);
  return { applied: true, changed: Boolean(currentAccessToken) };
}

export function handleSalesSessionExpired(): void {
  clearSalesSession({ redirectToLogin: true });
}

export function handleMissingAccessToken(): void {
  clearSalesSession({ clearAccessToken: true, redirectToLogin: true });
}

export async function restoreSalesSession({
  accessToken,
  getCurrentUser,
}: RestoreSessionOptions) {
  if (!accessToken) {
    return { ok: false, reason: 'missing_access_token', expired: true } as const;
  }

  const result = await getCurrentUser(accessToken);
  if (!result.success || !result.data) {
    if (result.isAuthInvalid) {
      clearSalesSession();
      return { ok: false, reason: result.error || 'expired', expired: true } as const;
    }

    return { ok: false, reason: result.error || 'network_error', expired: false } as const;
  }

  persistSalesUser(result.data);
  return { ok: true, user: result.data } as const;
}
