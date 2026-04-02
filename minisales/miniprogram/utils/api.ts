/**
 * API 请求封装
 * 统一处理请求头、Token、错误
 */

import { API_BASE_URL, STORAGE_KEYS } from './constants';
import { salesRequest } from '../services/http/request';
import { handleSalesSessionExpired } from '../services/auth/session';

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: unknown;
    header?: Record<string, string>;
    showLoading?: boolean;
    loadingText?: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    [key: string]: any; // Allow extra fields
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

    // 显示加载提示
    if (showLoading) {
        wx.showLoading({ title: loadingText, mask: true });
    }

    return salesRequest<T>({
        path: url,
        method,
        data,
        header,
    }).then((result) => {
        const payload = result.payload;
        const payloadError = typeof payload.error === 'string' ? payload.error : undefined;
        const payloadMessage = typeof payload.message === 'string' ? payload.message : undefined;
        const payloadSuccess = typeof payload.success === 'boolean' ? payload.success : result.success;
        const payloadData = (payload.data as T | undefined) ?? (result.data ?? undefined);

        const response: ApiResponse<T> = {
            ...payload,
            success: payloadSuccess,
            data: payloadData,
            error: payloadError ?? (result.error ?? undefined),
            message: payloadMessage ?? payloadError ?? (result.error ?? undefined),
        };

        if (result.status === 401) {
            handleSalesSessionExpired();
            throw new Error('登录已过期，请重新登录');
        }

        if (result.status >= 200 && result.status < 300) {
            return response;
        }

        if (result.status === 0) {
            console.error('Request failed:', result.detail ?? result.error);
            wx.showToast({ title: '网络请求失败', icon: 'none' });
            throw new Error('网络请求失败');
        }

        const errorMsg = response.error || response.message || result.error || '请求失败';
        wx.showToast({ title: errorMsg, icon: 'none' });
        throw new Error(errorMsg);
    }).finally(() => {
        if (showLoading) {
            wx.hideLoading();
        }
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
export function post<T = any>(url: string, data?: unknown, options?: Omit<RequestOptions, 'method' | 'data'>): Promise<ApiResponse<T>> {
    return request<T>(url, { ...options, method: 'POST', data });
}

/**
 * 上传文件
 */
export function uploadFile<T = any>(url: string, filePath: string, formData?: object): Promise<ApiResponse<T>> {
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
                    const response = JSON.parse(res.data) as ApiResponse<T>;
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

/**
 * 获取完整的文件 URL
 */
export function getFileUrl(path: string | undefined): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
}
