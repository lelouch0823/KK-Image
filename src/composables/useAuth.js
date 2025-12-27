/**
 * 认证相关 Composable
 * @module composables/useAuth
 */
import { ref, computed } from 'vue';

// 认证状态
const isAuthenticated = ref(false);

/**
 * 获取认证相关功能
 * @returns {Object} 认证相关的状态和方法
 */
export function useAuth() {
    /**
     * 获取认证头
     * 目前采用 Basic Auth 方式，凭证硬编码在环境变量或代码中
     * @returns {Object} 包含 Authorization 头的对象
     */
    const getAuthHeader = () => {
        // Basic Auth 凭证 (admin:123456)
        // 生产环境建议通过环境变量配置，此处保持与 Wrangler 配置一致
        return { 'Authorization': 'Basic ' + btoa('admin:123456') };
    };

    /**
     * 获取完整的请求头（包含认证和 Content-Type）
     * @param {boolean} includeContentType - 是否包含 JSON Content-Type
     * @returns {Object} 请求头对象
     */
    const getHeaders = (includeContentType = false) => {
        const headers = getAuthHeader();
        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    };

    /**
     * 带认证的 fetch 封装
     * @param {string} url - 请求 URL
     * @param {Object} options - fetch 选项
     * @returns {Promise<Response>} fetch 响应
     */
    const authFetch = async (url, options = {}) => {
        const headers = {
            ...options.headers,
            ...getAuthHeader()
        };
        return fetch(url, { ...options, headers });
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
        getAuthHeader,
        getHeaders,
        authFetch,
        authFetchJson
    };
}
