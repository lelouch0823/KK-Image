/**
 * API 请求封装
 * 统一处理请求头、Token、错误
 */

import { API_BASE_URL, STORAGE_KEYS } from './constants';

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: object;
    header?: Record<string, string>;
    showLoading?: boolean;
    loadingText?: string;
}

interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

/**
 * 获取存储的 JWT Token
 */
export function getToken(): string | null {
    return wx.getStorageSync(STORAGE_KEYS.TOKEN) || null;
}

/**
 * 设置 JWT Token
 */
export function setToken(token: string): void {
    wx.setStorageSync(STORAGE_KEYS.TOKEN, token);
}

/**
 * 清除 Token
 */
export function clearToken(): void {
    wx.removeStorageSync(STORAGE_KEYS.TOKEN);
}

/**
 * 获取 Access Token (URL 中的 token)
 */
export function getAccessToken(): string | null {
    return wx.getStorageSync(STORAGE_KEYS.ACCESS_TOKEN) || null;
}

/**
 * 设置 Access Token
 */
export function setAccessToken(token: string): void {
    wx.setStorageSync(STORAGE_KEYS.ACCESS_TOKEN, token);
}

/**
 * 统一请求方法
 */
export function request<T = any>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', data, header = {}, showLoading = false, loadingText = '加载中...' } = options;

    // 获取 Token
    const token = getToken();

    // 构建请求头
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...header,
    };

    // 如果有 Token，添加到请求头
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // 显示加载提示
    if (showLoading) {
        wx.showLoading({ title: loadingText, mask: true });
    }

    return new Promise((resolve, reject) => {
        wx.request({
            url: `${API_BASE_URL}${url}`,
            method,
            data,
            header: headers,
            success: (res) => {
                const response = res.data as ApiResponse<T>;

                if (res.statusCode === 401) {
                    // Token 过期，清除并跳转登录
                    clearToken();
                    wx.redirectTo({ url: '/pages/login/login' });
                    reject(new Error('登录已过期，请重新登录'));
                    return;
                }

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(response);
                } else {
                    const errorMsg = response.error || response.message || '请求失败';
                    wx.showToast({ title: errorMsg, icon: 'none' });
                    reject(new Error(errorMsg));
                }
            },
            fail: (err) => {
                console.error('Request failed:', err);
                wx.showToast({ title: '网络请求失败', icon: 'none' });
                reject(new Error('网络请求失败'));
            },
            complete: () => {
                if (showLoading) {
                    wx.hideLoading();
                }
            },
        });
    });
}

/**
 * GET 请求快捷方法
 */
export function get<T = any>(url: string, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return request<T>(url, { ...options, method: 'GET' });
}

/**
 * POST 请求快捷方法
 */
export function post<T = any>(url: string, data?: object, options?: Omit<RequestOptions, 'method' | 'data'>): Promise<ApiResponse<T>> {
    return request<T>(url, { ...options, method: 'POST', data });
}

/**
 * 上传文件
 */
export function uploadFile(url: string, filePath: string, formData?: object): Promise<ApiResponse> {
    const token = getToken();

    return new Promise((resolve, reject) => {
        wx.uploadFile({
            url: `${API_BASE_URL}${url}`,
            filePath,
            name: 'file',
            formData: formData as any,
            header: token ? { 'Authorization': `Bearer ${token}` } : {},
            success: (res) => {
                try {
                    const response = JSON.parse(res.data) as ApiResponse;
                    if (res.statusCode >= 200 && res.statusCode < 300 && response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error || response.message || '上传失败'));
                    }
                } catch (e) {
                    reject(new Error('解析响应失败'));
                }
            },
            fail: (err) => {
                console.error('Upload failed:', err);
                reject(new Error('上传失败'));
            },
        });
    });
}
