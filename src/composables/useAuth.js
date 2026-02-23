/**
 * 认证相关 Composable
 * @module composables/useAuth
 */
import { ref } from 'vue';
import { API } from '@/utils/constants';

// 全局状态
const isAuthenticated = ref(false);
const currentUser = ref(null);
const isLoading = ref(true);

// 全局 AbortController，用于管理所有认证相关的请求
let abortController = new AbortController();

/**
 * 获取认证相关功能
 * @returns {Object} 认证相关的状态和方法
 */
export function useAuth() {
  /**
   * 检查登录状态
   * @returns {Promise<boolean>} 是否已登录
   */
  const checkAuth = async () => {
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
        const result = await response.json();
        if (result.success) {
          isAuthenticated.value = true;
          currentUser.value = result.data;
          return true;
        }
      }

      // 认证失败
      isAuthenticated.value = false;
      currentUser.value = null;
      return false;
    } catch (error) {
      if (error.name === 'AbortError') {
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
   * @param {string} url - 请求 URL
   * @param {Object} options - fetch 选项
   * @returns {Promise<Response>} fetch 响应
   */
  const authFetch = async (url, options = {}) => {
    // 确保携带凭证 (Cookie) 并绑定 signal
    const opts = {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
      },
      // 如果调用者没有提供 signal，则使用全局 controller 的 signal
      signal: options.signal || abortController.signal,
    };

    try {
      const response = await fetch(url, opts);

      // 如果遇到 401，更新状态
      if (response.status === 401) {
        isAuthenticated.value = false;
        currentUser.value = null;
      }

      // HTTP 错误抛出，交由拦截器或业务层处理
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(errorData.error || response.statusText);
        err.status = response.status;
        err.data = errorData;
        throw err;
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
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
   * @param {string} url - 请求 URL
   * @param {Object} options - fetch 选项
   * @returns {Promise<Object>} 解析后的 JSON 数据
   */
  const authFetchJson = async (url, options = {}) => {
    const response = await authFetch(url, options);
    return response.json();
  };

  /**
   * 退出登录
   */
  const logout = async () => {
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
