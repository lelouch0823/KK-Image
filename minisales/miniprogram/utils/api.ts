/**
 * API 请求封装
 * 统一处理请求头、Token、错误
 */

import { API_BASE_URL, STORAGE_KEYS } from './constants';
import { salesRequest } from '../services/http/request';

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
        data: data as Record<string, unknown> | unknown[] | undefined,
        header,
    }).then((result) => {
        if (result.status === 401) {
            clearToken();
            wx.redirectTo({ url: '/pages/login/login' });
        }

        if (!result.success && result.error) {
            wx.showToast({ title: result.error, icon: 'none' });
        }

        return {
            success: result.success,
            data: result.data ?? undefined,
            error: result.error ?? undefined,
            message: result.error ?? undefined,
            code: result.code ?? undefined,
            status: result.status,
        };
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
