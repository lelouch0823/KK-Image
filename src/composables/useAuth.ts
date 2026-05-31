/**
 * 认证相关 Composable
 * @module composables/useAuth
 */
import { ref, type Ref } from 'vue';
import { API } from '@/utils/constants';
import { request } from '@/utils/http-core';

/** 用户信息接口 */
interface UserInfo {
  id?: string;
  username?: string;
  role?: string;
  [key: string]: unknown;
}

/** API 通用响应结构 */
interface AuthApiResponse {
  success: boolean;
  data?: UserInfo;
  [key: string]: unknown;
}

// 全局状态
const isAuthenticated: Ref<boolean> = ref(false);
const currentUser: Ref<UserInfo | null> = ref(null);
const isLoading: Ref<boolean> = ref(true);

// 全局 AbortController，用于管理所有认证相关的请求
let abortController = new AbortController();

/**
 * 获取认证相关功能
 * @returns 认证相关的状态和方法
 */
export function useAuth() {
  /**
   * 检查登录状态
   * @returns 是否已登录
   */
  const checkAuth = async (): Promise<boolean> => {
    try {
      isLoading.value = true;
      const response = await fetch(API.USER, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
      });

      if (response.ok) {
        const result: AuthApiResponse = await response.json();
        if (result.success) {
          isAuthenticated.value = true;
          currentUser.value = result.data ?? null;
          return true;
        }
      }

      // 认证失败
      isAuthenticated.value = false;
      currentUser.value = null;
      return false;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 请求被中止（例如退出登录），忽略错误
        console.debug('Auth check aborted');
        return false;
      }
      console.error('Auth check failed:', error);
      isAuthenticated.value = false;
      currentUser.value = null;
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 带认证的 fetch 封装
   * @param url - 请求 URL
   * @param options - fetch 选项
   * @returns fetch 响应
   */
  const authFetch = async (url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> => {
    // 确保携带凭证 (Cookie) 并绑定 signal
    const opts = {
      ...options,
      credentials: 'include' as const,
      headers: {
        ...options.headers,
      },
      // 如果调用者没有提供 signal，则使用全局 controller 的 signal
      signal: options.signal || abortController.signal,
    };

    try {
      return await request(url, opts);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'status' in error && (error as Record<string, unknown>).status === 401) {
        isAuthenticated.value = false;
        currentUser.value = null;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        console.debug(`Request to ${url} aborted`);
        // 抛出或返回特定的中止对象，视具体需求而定
        // 这里重新抛出以便调用者（如果需要）也能感知
        throw error;
      }
      throw error;
    }
  };

  /**
   * 带认证的 JSON fetch 封装
   * @param url - 请求 URL
   * @param options - fetch 选项
   * @returns 解析后的 JSON 数据
   */
  const authFetchJson = async <T = unknown>(url: string, options: RequestInit & { timeout?: number } = {}): Promise<T> => {
    const response = await authFetch(url, options);
    return response.json() as Promise<T>;
  };

  /**
   * 退出登录
   */
  const logout = async (): Promise<void> => {
    try {
      // 1. 中止所有正在进行的请求（防止 401 报错）
      abortController.abort();

      // 2. 重新初始化 controller 以便后续请求（如下次登录）可用
      abortController = new AbortController();

      // 3. 发送退出请求（使用新的 signal，因为旧的已被中止）
      await fetch(API.LOGOUT, {
        method: 'POST',
        credentials: 'include',
        signal: abortController.signal
      });
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      isAuthenticated.value = false;
      currentUser.value = null;
    }
  };

  return {
    isAuthenticated,
    currentUser,
    isLoading,
    checkAuth,
    authFetch,
    authFetchJson,
    logout,
  };
}
