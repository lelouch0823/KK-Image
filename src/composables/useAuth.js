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
                headers: {
                    'Content-Type': 'application/json'
                }
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
        // 确保携带凭证 (Cookie)
        const opts = {
            ...options,
            credentials: 'include',
            headers: {
                ...options.headers
            }
        };

        const response = await fetch(url, opts);

        // 如果遇到 401，更新状态
        if (response.status === 401) {
            isAuthenticated.value = false;
            currentUser.value = null;
        }

        return response;
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

    return {
        isAuthenticated,
        currentUser,
        isLoading,
        checkAuth,
        authFetch,
        authFetchJson
    };
}
